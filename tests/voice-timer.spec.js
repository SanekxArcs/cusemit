import { test, expect } from '@playwright/test';

const endpoint =
  'https://generativelanguage.googleapis.com/**/*:generateContent';
const modelEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite';
const duration = {
  transcript: 'Постав таймер на 30 секунд',
  label: 'Чай',
  mode: 'duration',
  durationSeconds: 30,
  targetDatetime: '',
};

async function setup(page, options = {}) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.addInitScript((options) => {
    localStorage.setItem(
      'app.clock.settings.v1',
      JSON.stringify({ autoHideControls: false, animationMode: 'none' })
    );
    window.voiceTest = {
      stopped: 0,
      recordings: 0,
      contexts: 0,
      analysers: 0,
      closed: 0,
    };
    if (options.analyser) {
      window.AudioContext = class {
        constructor() {
          window.voiceTest.contexts++;
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        createAnalyser() {
          window.voiceTest.analysers++;
          return {
            frequencyBinCount: 128,
            disconnect() {},
            getByteFrequencyData(samples) {
              samples.fill(180);
            },
          };
        }
        resume() {
          return Promise.resolve();
        }
        close() {
          window.voiceTest.closed++;
          return Promise.resolve();
        }
      };
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        if (options.denied) throw new DOMException('Denied', 'NotAllowedError');
        const input = {
          getTracks: () => [{ stop: () => window.voiceTest.stopped++ }],
        };
        if (options.pending)
          return new Promise((resolve) => {
            window.voiceTest.allow = () => resolve(input);
          });
        return input;
      },
    });
    window.MediaRecorder = class {
      static isTypeSupported() {
        return true;
      }
      constructor(input, config) {
        this.state = 'inactive';
        this.mimeType = config.mimeType;
      }
      start() {
        this.state = 'recording';
        window.voiceTest.recordings++;
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({
          data: new Blob(['test-audio'], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    };
  }, options);
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
  await page.goto('/');
  await page.route(modelEndpoint, (route) =>
    route.fulfill({
      status: options.badKey ? 403 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ supportedGenerationMethods: ['generateContent'] }),
    })
  );
  await page
    .getByRole('button', { name: 'Voice settings', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Voice', exact: true })
  ).toBeVisible();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('test-key-not-real');
  await page.getByRole('button', { name: 'Check key', exact: true }).click();
  if (options.badKey) return;
  await expect(
    page.getByRole('button', { name: 'Key verified' })
  ).toBeVisible();
  if (options.hold)
    await page.getByRole('switch', { name: 'Hold to talk' }).click();
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
}

async function reply(page, command = duration, status = 200) {
  await page.route(endpoint, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify(command) }] },
          },
        ],
      }),
    })
  );
}

async function record(page) {
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await expect(page.locator('.voice-feedback')).toContainText('Listening');
  await page
    .getByRole('button', { name: 'Stop & interpret', exact: true })
    .click();
}

const notices = (page) => page.locator('[data-sonner-toast]');
const timers = (page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('app.clock.settings.v1')).timers || []
  );

test('tap recording auto-starts a timer, never persists the key, and Undo removes it', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  const sent = page.waitForRequest(endpoint);
  await record(page);
  const request = await sent;
  expect(request.headers()['x-goog-api-key']).toBe('test-key-not-real');
  expect(request.url()).not.toContain('test-key');
  expect(request.postDataJSON().contents[0].parts[1].inlineData).toEqual({
    mimeType: 'audio/webm',
    data: 'dGVzdC1hdWRpbw==',
  });
  await expect(notices(page)).toContainText('Timer started: Чай');
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('00:00:30Running');
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })
    )
  ).not.toContain('test-key-not-real');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.timer-readout')).toHaveCount(0);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

test('absolute time starts automatically in the local timezone', async ({
  page,
}) => {
  await setup(page);
  await reply(page, {
    ...duration,
    mode: 'datetime',
    durationSeconds: 0,
    targetDatetime: '2026-11-01T18:30:00+01:00',
  });
  await record(page);
  await expect(notices(page)).toContainText('Timer started');
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('05:30:00Running');
});

for (const [name, command] of [
  ['unclear speech', { ...duration, mode: 'unclear' }],
  ['negative duration', { ...duration, durationSeconds: -10 }],
  ['fractional duration', { ...duration, durationSeconds: 1.5 }],
  ['oversized duration', { ...duration, durationSeconds: 9999999 }],
  [
    'past target',
    { ...duration, mode: 'datetime', targetDatetime: '2026-10-31T18:00:00Z' },
  ],
  [
    'invalid date',
    { ...duration, mode: 'datetime', targetDatetime: '2027-02-30T18:00:00Z' },
  ],
  [
    'no timezone',
    { ...duration, mode: 'datetime', targetDatetime: '2027-01-01T18:00:00' },
  ],
]) {
  test('rejects ' + name + ' without changing timers', async ({ page }) => {
    await setup(page);
    await reply(page, command);
    await record(page);
    await expect(notices(page)).toHaveAttribute('data-type', 'error');
    expect(await timers(page)).toHaveLength(0);
  });
}

test('quota error permits retry, revoked key hides the microphone', async ({
  page,
}) => {
  await setup(page);
  await reply(page, duration, 429);
  await record(page);
  await expect(notices(page)).toContainText('quota');
  await page.unroute(endpoint);
  await reply(page);
  await record(page);
  await expect(
    notices(page).filter({ hasText: 'Timer started' })
  ).toBeVisible();
  await page.unroute(endpoint);
  await reply(page, duration, 403);
  await record(page);
  await expect(page.locator('.voice-dock')).toHaveCount(0);
});

test('no key or rejected key never shows a microphone', async ({ page }) => {
  await setup(page, { badKey: true });
  await expect(page.getByRole('alert')).toContainText('Key check failed');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.voice-dock')).toHaveCount(0);
});

test('cancel and settings release the microphone without uploading; reload forgets key', async ({
  page,
}) => {
  await setup(page);
  let uploads = 0;
  await page.route(endpoint, (route) => {
    uploads++;
    return route.abort();
  });
  await page.getByRole('button', { name: 'Record command' }).click();
  await page.getByRole('button', { name: 'Cancel voice timer' }).click();
  await page.getByRole('button', { name: 'Record command' }).click();
  await page.getByRole('button', { name: 'Voice settings' }).click();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toHaveValue(
    'test-key-not-real'
  );
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(2);
  expect(uploads).toBe(0);
  await page.getByRole('button', { name: 'Forget key' }).click();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toBeEmpty();
  await page.reload();
  await expect(page.locator('.voice-dock')).toHaveCount(0);
});

test('hold release sends once, mode persists but key does not', async ({
  page,
}) => {
  await setup(page, { hold: true });
  await reply(page);
  const button = page.getByRole('button', {
    name: 'Hold to talk',
    exact: true,
  });
  await button.hover();
  await page.mouse.down();
  await expect(page.locator('.voice-waves i')).toHaveCount(13);
  await page.mouse.up();
  await expect(notices(page)).toContainText('Timer started');
  expect(await timers(page)).toHaveLength(1);
  expect(await page.evaluate(() => window.voiceTest.recordings)).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Voice settings' }).click();
  await expect(
    page.getByRole('switch', { name: 'Hold to talk' })
  ).toBeChecked();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toBeEmpty();
});

test('release before microphone permission resolves discards late input', async ({
  page,
}) => {
  await setup(page, { hold: true, pending: true });
  await page.getByRole('button', { name: 'Hold to talk', exact: true }).hover();
  await page.mouse.down();
  await expect(page.locator('.voice-feedback')).toContainText(
    'Allow microphone'
  );
  await page.mouse.up();
  await page.evaluate(() => window.voiceTest.allow());
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.stopped))
    .toBe(1);
  expect(await timers(page)).toHaveLength(0);
});

test('permission denial permits retry', async ({ page }) => {
  await setup(page, { denied: true });
  await page.getByRole('button', { name: 'Record command' }).click();
  await expect(notices(page)).toContainText('permission was denied');
  await expect(
    page.getByRole('button', { name: 'Record command' })
  ).toBeEnabled();
});

test('offline cancels recording and hides button until reconnect', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Record command' }).click();
  await expect(page.locator('.voice-waves')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('.voice-dock')).toHaveCount(0);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event('online'));
  });
  await expect(
    page.getByRole('button', { name: 'Record command' })
  ).toBeVisible();
});

test('spinner and cancel ignore a late response', async ({ page }) => {
  await setup(page);
  let finish;
  const ready = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route(endpoint, async (route) => {
    await ready;
    await route
      .fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: JSON.stringify(duration) }] },
            },
          ],
        }),
      })
      .catch(() => {});
  });
  await record(page);
  await expect(page.locator('.voice-spinner')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel voice timer' }).click();
  finish();
  await expect(
    page.getByRole('button', { name: 'Record command' })
  ).toBeEnabled();
  expect(await timers(page)).toHaveLength(0);
});

test('Undo preserves an existing running timer', async ({ page }) => {
  await setup(page);
  await reply(page);
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await page.getByRole('button', { name: 'Add timer' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  const original = (await timers(page))[0].id;
  await record(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await timers(page)).map((timer) => timer.id)).toEqual([original]);
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('Running');
});

test('recording limit auto-sends and controls share idle timeout', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await setup(page);
  await reply(page);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('switch', { name: 'Auto-hide controls' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.clock.fastForward(10001);
  await expect(page.locator('.voice-dock')).toHaveClass(/voice-dock-hidden/);
  await expect(page.locator('.settings-rail')).toHaveClass(/rail-hidden/);
  await page.mouse.move(200, 200);
  await page.getByRole('button', { name: 'Record command' }).click();
  await page.clock.fastForward(14000);
  await expect(page.locator('.voice-dock')).not.toHaveClass(
    /voice-dock-hidden/
  );
  await page.clock.fastForward(1001);
  await expect(notices(page)).toContainText('Timer started');
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

test('hold keyboard and touch release use the same send flow', async ({
  page,
}) => {
  await setup(page, { hold: true });
  await reply(page);
  const button = page.getByRole('button', {
    name: 'Hold to talk',
    exact: true,
  });
  await button.focus();
  await page.keyboard.down('Space');
  await expect(page.locator('.voice-waves')).toBeVisible();
  await page.keyboard.up('Space');
  await expect(notices(page)).toContainText('Timer started');
  const client = await page.context().newCDPSession(page);
  const box = await button.boundingBox();
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(page.locator('.voice-waves')).toBeVisible();
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect.poll(async () => (await timers(page)).length).toBe(2);
});

test('live analyser drives waves and releases resources on cancel', async ({
  page,
}) => {
  await setup(page, { analyser: true });
  await page.getByRole('button', { name: 'Record command' }).click();
  await expect(page.locator('.voice-waves')).toHaveAttribute(
    'data-reactive',
    'true'
  );
  await expect
    .poll(() =>
      page
        .locator('.voice-waves i')
        .first()
        .evaluate((bar) => bar.style.transform)
    )
    .toContain('scaleY');
  await page.getByRole('button', { name: 'Cancel voice timer' }).click();
  expect(await page.evaluate(() => window.voiceTest.analysers)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.closed)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

test('reduced motion keeps feedback static without starting an analyser', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, { analyser: true });
  await page.getByRole('button', { name: 'Record command' }).click();
  await expect(page.locator('.voice-waves')).toBeVisible();
  expect(
    await page
      .locator('.voice-waves i')
      .first()
      .evaluate((bar) => getComputedStyle(bar).animationName)
  ).toBe('none');
  expect(await page.evaluate(() => window.voiceTest.analysers)).toBe(0);
});

test('hidden tab discards recording without uploading', async ({ page }) => {
  await setup(page);
  let uploads = 0;
  await page.route(endpoint, (route) => {
    uploads++;
    return route.abort();
  });
  await page.getByRole('button', { name: 'Record command' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.voice-feedback')).toHaveCount(0);
  expect(uploads).toBe(0);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

for (const width of [390, 1440]) {
  test(
    'voice interaction fits at ' + width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page);
      await page.getByRole('button', { name: 'Record command' }).click();
      const box = await page.locator('.voice-dock').boundingBox();
      expect(box.x).toBeLessThan(40);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth
        )
      ).toBeLessThanOrEqual(1);
      await expect(page.locator('.voice-waves')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('voice-listening.png'),
      });
    }
  );
}
