import { test, expect } from '@playwright/test';

const modelEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite';
const endpoint =
  'https://generativelanguage.googleapis.com/**/*:generateContent';
test.use({ serviceWorkers: 'block' });
const configKey = 'app.clock.handsfree.v2';
const dock = (page) => page.locator('.voice-dock');
const notices = (page) => page.locator('[data-sonner-toast]');

async function setup(page, options = {}) {
  await page.addInitScript(
    ({ configKey, options }) => {
      if (!sessionStorage.getItem('hf-test')) {
        sessionStorage.setItem('hf-test', 'true');
        localStorage.setItem(
          'app.clock.settings.v1',
          JSON.stringify({
            animationMode: 'none',
            autoHideControls: options.autoHideControls ?? false,
            timers: [],
          })
        );
        localStorage.setItem('app.clock.voice.key.v1', 'fake-gemini-key');
        localStorage.setItem(
          configKey,
          JSON.stringify({
            phrase: 'Computer',
            silenceMs: options.silenceMs || 1500,
            ...options.config,
          })
        );
      }
      window.hf = { starts: 0, stops: 0, frames: 0 };
    },
    { configKey, options }
  );
  await page.route(modelEndpoint, (route) =>
    route.fulfill({ json: { supportedGenerationMethods: ['generateContent'] } })
  );
  await page.route('**/assets/wakeWordEngine-*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body:
        'export async function startWakeWord(options, signal) {' +
        'window.hf.starts++; window.hf.options = options; window.hf.signal = signal;' +
        'window.hf.wake = () => options.onWake();' +
        'window.hf.feed = (count, amplitude = 6000) => { for(let frame = 0; frame < count; frame++) {' +
        'options.onFrame(Int16Array.from({length:512}, (_,index) => Math.sin(index * 0.17) * amplitude)); window.hf.frames++; }};' +
        'signal.addEventListener("abort", () => window.hf.stops++, {once:true});' +
        (options.failed ? 'throw new Error("SDK failed");' : '') +
        (options.pending
          ? 'await new Promise(resolve => window.hf.allow = resolve);'
          : '') +
        '}',
    })
  );
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Record command', exact: true })
  ).toBeVisible();
}

async function settings(page) {
  await page
    .getByRole('button', { name: 'Voice settings', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Hands-free · experimental' })
  ).toBeVisible();
}
async function close(page) {
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
}
async function enable(page, ready = true) {
  await settings(page);
  await page.getByRole('switch', { name: 'Hands-free listening' }).click();
  await close(page);
  if (ready) await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
}
async function wake(page) {
  await page.evaluate(() => window.hf.wake());
  await expect(dock(page)).toHaveAttribute('data-phase', 'recording');
}
async function feed(page, frames, amplitude) {
  await page.evaluate(
    ({ frames, amplitude }) => window.hf.feed(frames, amplitude),
    { frames, amplitude }
  );
}
async function reply(page, status = 200, mode = 'duration') {
  await page.route(endpoint, (route) =>
    route.fulfill({
      status,
      json: {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    transcript: 'five minutes for tea',
                    label: 'Tea',
                    mode,
                    durationSeconds: 300,
                    targetDatetime: '',
                  }),
                },
              ],
            },
          },
        ],
      },
    })
  );
}
async function timers(page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('app.clock.settings.v1')).timers || []
  );
}

test('armed microphone hides with side controls and screen input reveals it without stopping listening', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await setup(page, { autoHideControls: true });
  await enable(page);
  const stops = await page.evaluate(() => window.hf.stops);
  const waitForIdle = async () => {
    for (let second = 0; second < 11; second++) {
      await feed(page, 1, 0);
      await page.clock.fastForward(1000);
    }
  };
  await waitForIdle();
  await expect(dock(page)).toHaveClass(/voice-dock-hidden/);
  await expect(dock(page)).toHaveAttribute('inert', '');
  await expect(page.locator('.settings-rail')).toHaveClass(/rail-hidden/);
  await expect(page.locator('.voice-handsfree')).toContainText('Say “Computer”');
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  expect(await page.evaluate(() => window.hf.stops)).toBe(stops);
  await page.mouse.click(200, 200);
  await expect(dock(page)).not.toHaveClass(/voice-dock-hidden/);
  await expect(dock(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('.settings-rail')).not.toHaveClass(/rail-hidden/);
  await waitForIdle();
  await expect(dock(page)).toHaveClass(/voice-dock-hidden/);
  await page.dispatchEvent('body', 'touchstart', { touches: [] });
  await expect(dock(page)).not.toHaveClass(/voice-dock-hidden/);
  await waitForIdle();
  await wake(page);
  await expect(page.locator('.voice-waves')).toBeVisible();
  await expect(dock(page)).not.toHaveClass(/voice-dock-hidden/);
});

test('does not load the SDK, open a listener or upload waiting audio without explicit opt-in', async ({
  page,
}) => {
  let sdkRequests = 0;
  let audioRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('wakeWordEngine-')) sdkRequests++;
    if (request.url().includes(':generateContent')) audioRequests++;
  });
  await setup(page);
  expect(sdkRequests).toBe(0);
  await enable(page);
  await feed(page, 200);
  expect(sdkRequests).toBe(1);
  expect(audioRequests).toBe(0);
  await expect(page.locator('.voice-handsfree')).toContainText('Say “Computer”');
  expect(await timers(page)).toHaveLength(0);
});

test('wake phrase plus speech sends once after 1.5 seconds of silence, starts timer and supports Undo', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  let uploads = 0;
  page.on('request', (request) => {
    if (request.url().includes(':generateContent')) uploads++;
  });
  await enable(page);
  await wake(page);
  await expect(page.locator('.voice-waves i')).toHaveCount(13);
  await feed(page, 12);
  await feed(page, 46, 0);
  expect(uploads).toBe(0);
  const sent = page.waitForRequest(endpoint);
  await feed(page, 1, 0);
  const request = await sent;
  expect(request.headers()['x-goog-api-key']).toBe('fake-gemini-key');
  expect(request.url()).not.toContain('fake-');
  const audio = request.postDataJSON().contents[0].parts[1].inlineData;
  expect(audio.mimeType).toBe('audio/wav');
  expect(Buffer.from(audio.data, 'base64').toString('ascii', 0, 4)).toBe(
    'RIFF'
  );
  await expect(notices(page)).toContainText('Timer started: Tea');
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  expect(uploads).toBe(1);
  await expect.poll(() => timers(page)).toHaveLength(1);
  expect((await timers(page))[0]).toMatchObject({ autoDelete: true, alarmSound: 'chime' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => timers(page)).toHaveLength(0);
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
});

for (const mode of ['cancel_last', 'cancel_all']) {
  test('hands-free ' + mode + ' cancels and Undo restores without leaving armed mode', async ({ page }) => {
    await setup(page);
    await reply(page);
    await enable(page);
    await wake(page);
    await feed(page, 12);
    await feed(page, 47, 0);
    await expect.poll(() => timers(page)).toHaveLength(1);
    const original = await timers(page);
    await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
    await reply(page, 200, mode);
    await wake(page);
    await feed(page, 12);
    await feed(page, 47, 0);
    await expect.poll(() => timers(page)).toHaveLength(0);
    await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
    await notices(page).filter({ hasText: 'Timer cancelled:' }).getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => timers(page)).toEqual(original);
    await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  });
}

test('a silent false activation returns to waiting without calling Gemini', async ({
  page,
}) => {
  await setup(page);
  let uploads = 0;
  page.on('request', (request) => {
    if (request.url().includes(':generateContent')) uploads++;
  });
  await enable(page);
  await wake(page);
  await feed(page, 157, 0);
  await expect(notices(page)).toContainText('No command heard');
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  expect(uploads).toBe(0);
});

test('continuous speech auto-sends at fifteen seconds and the next command still works', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  await enable(page);
  for (let index = 1; index <= 2; index++) {
    await wake(page);
    await feed(page, 469);
    await expect.poll(() => timers(page)).toHaveLength(index);
    await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  }
  expect(await page.evaluate(() => window.hf.starts)).toBe(1);
});

for (const event of ['blur', 'pagehide', 'offline', 'hidden', 'escape']) {
  test(
    'privacy stop cancels capture and requires opt-in again after ' + event,
    async ({ page }) => {
      await setup(page);
      await enable(page);
      await wake(page);
      await feed(page, 12);
      await page.evaluate((event) => {
        if (event === 'hidden') {
          Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
          });
          document.dispatchEvent(new Event('visibilitychange'));
        } else if (event === 'escape')
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        else window.dispatchEvent(new Event(event));
      }, event);
      await expect.poll(() => page.evaluate(() => window.hf.stops)).toBe(1);
      expect(await timers(page)).toHaveLength(0);
      await expect(
        page.getByRole('button', { name: 'Stop hands-free listening' })
      ).toHaveCount(0);
    }
  );
}

test('opening settings pauses the microphone and closing resumes without overlapping listeners', async ({
  page,
}) => {
  await setup(page);
  await enable(page);
  await settings(page);
  await expect.poll(() => page.evaluate(() => window.hf.stops)).toBe(1);
  await close(page);
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  expect(await page.evaluate(() => window.hf.starts)).toBe(2);
});

test('stopping during startup ignores late permission and never arms', async ({
  page,
}) => {
  await setup(page, { pending: true });
  await enable(page, false);
  await expect.poll(() => page.evaluate(() => window.hf.starts)).toBe(1);
  await page.getByRole('button', { name: 'Stop hands-free listening' }).click();
  await page.evaluate(() => window.hf.allow());
  await expect(dock(page)).toHaveAttribute('data-phase', 'idle');
  expect(await page.evaluate(() => window.hf.signal.aborted)).toBe(true);
});

test('manual button can start and send a command using the already-open listener', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  await enable(page);
  await page.getByRole('button', { name: 'Record hands-free command' }).click();
  await feed(page, 12);
  await page.getByRole('button', { name: 'Send hands-free command' }).click();
  await expect.poll(() => timers(page)).toHaveLength(1);
  expect(await page.evaluate(() => window.hf.starts)).toBe(1);
});

test('stopping during Gemini processing ignores late results and repeated wakes', async ({
  page,
}) => {
  await setup(page);
  let release;
  await page.route(endpoint, async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        json: {
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      transcript: 'five minutes',
                      label: 'Tea',
                      mode: 'duration',
                      durationSeconds: 300,
                    }),
                  },
                ],
              },
            },
          ],
        },
      })
      .catch(() => {});
  });
  await enable(page);
  await wake(page);
  await feed(page, 12);
  const sent = page.waitForRequest(endpoint);
  await feed(page, 47, 0);
  await sent;
  await page.evaluate(() => {
    window.hf.wake();
    window.hf.feed(60);
  });
  await expect(dock(page)).toHaveAttribute('data-phase', 'processing');
  await page.getByRole('button', { name: 'Stop hands-free listening' }).click();
  release();
  await expect(dock(page)).toHaveAttribute('data-phase', 'idle');
  expect(await timers(page)).toHaveLength(0);
});

test('a failed engine disables hands-free but leaves manual recording available', async ({
  page,
}) => {
  await setup(page, { failed: true });
  await enable(page, false);
  await expect(notices(page)).toContainText(
    'Could not start local wake-word detection'
  );
  await expect(
    page.getByRole('button', { name: 'Record command', exact: true })
  ).toBeVisible();
});

test('phrase persists but reload never silently reopens the microphone', async ({ page }) => {
  await setup(page);
  await enable(page);
  await page.reload();
  await settings(page);
  await expect(page.getByRole('radio', { name: 'Computer', exact: true })).toHaveAttribute('data-state', 'on');
  await expect(page.getByRole('switch', { name: 'Hands-free listening' })).not.toBeChecked();
  await expect(page.getByText('Picovoice AccessKey', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.hf.starts)).toBe(0);
});

for (const phrase of ['Hey Clock', 'One Plus']) {
  test(phrase + ' starts without another key or training', async ({ page }) => {
    await setup(page);
    await settings(page);
    await page.getByRole('radio', { name: phrase, exact: true }).click();
    await page.getByRole('switch', { name: 'Hands-free listening' }).click();
    await close(page);
    await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
    expect(await page.evaluate(() => window.hf.options.phrase)).toBe(phrase);
    await wake(page);
  });
}

test('legacy credentials and models are removed while preserving preferences', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('app.clock.handsfree.v1', JSON.stringify({
      accessKey: 'obsolete-key', keyword: 'obsolete-model', keywordLabel: 'Hey Clock',
      phrase: 'Hey Clock', silenceMs: 2200,
    }));
  });
  await setup(page);
  await page.evaluate(() => localStorage.removeItem('app.clock.handsfree.v2'));
  await page.reload();
  const saved = await page.evaluate(() => ({
    old: localStorage.getItem('app.clock.handsfree.v1'),
    current: JSON.parse(localStorage.getItem('app.clock.handsfree.v2')),
  }));
  expect(saved.old).toBeNull();
  expect(saved.current).toEqual({ phrase: 'Hey Clock', silenceMs: 2200 });
  expect(await page.evaluate(() => window.hf.starts)).toBe(0);
});

test('malformed legacy storage cannot retain old credentials or enable listening', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    localStorage.removeItem('app.clock.handsfree.v2');
    localStorage.setItem('app.clock.handsfree.v1', '{"accessKey":"obsolete-key"');
  });
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('app.clock.handsfree.v1'))).toBeNull();
  expect(await page.evaluate(() => window.hf.starts)).toBe(0);
});

test('daily 04:00 maintenance does not reload an armed hands-free session', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 3, 59, 58) });
  await setup(page);
  await enable(page);
  await page.clock.runFor(2500);
  await expect(dock(page)).toHaveAttribute('data-phase', 'armed');
  expect(await page.evaluate(() => window.hf.starts)).toBe(1);
});

test('stored Cusemit wake phrase migrates to One Plus', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => localStorage.setItem('app.clock.handsfree.v2', JSON.stringify({ phrase: 'Hey Cusemit', silenceMs: 1500 })));
  await page.reload();
  await settings(page);
  await expect(page.getByRole('radio', { name: 'One Plus', exact: true })).toHaveAttribute('data-state', 'on');
  await expect(page.getByRole('radio', { name: 'Hey Cusemit', exact: true })).toHaveCount(0);
});

for (const width of [320, 390, 768, 1440]) {
  test('centered hands-free states fit at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await enable(page);
    const status = page.locator('.voice-handsfree');
    const mic = page.locator('.voice-mic');
    await expect(status).toContainText('Say “Computer” to trigger');
    await expect(status.locator('.voice-capsule')).toHaveCount(0);
    const assertPlacement = async () => {
      const box = await status.boundingBox();
      const button = await mic.boundingBox();
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(1);
      expect(box.y + box.height).toBeLessThanOrEqual(880);
      expect(box.x).toBeGreaterThan(button.x + button.width);
      expect(button.x).toBeLessThan(30);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    };
    await assertPlacement();
    if ([390, 1440].includes(width)) await page.screenshot({ path: 'artifacts/handsfree-' + width + '-armed.png' });
    await wake(page);
    await feed(page, 12);
    await expect(status.locator('.voice-waves i')).toHaveCount(13);
    await assertPlacement();
    if ([390, 1440].includes(width)) await page.screenshot({ path: 'artifacts/handsfree-' + width + '-recording.png' });
    let pending;
    await page.route(endpoint, route => { pending = route; });
    await feed(page, 47, 0);
    await expect(status).toHaveAttribute('data-phase', 'processing');
    await expect(status.locator('.voice-spinner')).toBeVisible();
    await assertPlacement();
    if ([390, 1440].includes(width)) await page.screenshot({ path: 'artifacts/handsfree-' + width + '-processing.png' });
    await page.getByRole('button', { name: 'Stop hands-free listening' }).click();
    await pending?.abort().catch(() => {});
    await expect(status).toHaveCount(0);
  });
}

test('hands-free feedback respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await enable(page);
  await wake(page);
  const status = page.locator('.voice-handsfree');
  await expect(status).toHaveAttribute('data-reduced-motion', 'true');
  await expect(status.locator('.voice-capsule')).toHaveCSS('animation-name', 'none');
  await expect(status.locator('.voice-waves i').first()).toHaveCSS('animation-name', 'none');
});
