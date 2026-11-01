import { test, expect } from '@playwright/test';

const endpoint = 'https://generativelanguage.googleapis.com/**';
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
    window.voiceTest = { stopped: 0, recordings: 0 };
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
  await page.getByRole('button', { name: 'Voice timer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Voice timer', exact: true })
  ).toBeVisible();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('test-key-not-real');
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
  await expect(page.getByRole('status')).toContainText('Listening');
  await page
    .getByRole('button', { name: 'Stop & interpret', exact: true })
    .click();
}

test('duration requires confirmation, starts with seconds, and does not persist the API key', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  const sent = page.waitForRequest(endpoint);
  await record(page);
  const request = await sent;
  expect(request.url()).toContain('/gemini-3.5-flash-lite:generateContent');
  expect(request.url()).not.toContain('test-key');
  expect(request.headers()['x-goog-api-key']).toBe('test-key-not-real');
  expect(request.postDataJSON().contents[0].parts[1].inlineData).toEqual({
    mimeType: 'audio/webm',
    data: 'dGVzdC1hdWRpbw==',
  });
  await expect(
    page.getByText(duration.transcript, { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('app.clock.settings.v1')).timers
    )
  ).toBeUndefined();
  await page
    .getByRole('button', { name: 'Create & start timer', exact: true })
    .click();
  await expect(page.locator('.timer-readout')).toContainText('00:00:30Running');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText(
    'Ready when you are'
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('00:00:30');
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })
    )
  ).not.toContain('test-key-not-real');
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

test('absolute time uses the local timezone in the timer editor', async ({
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
  await page
    .getByRole('button', { name: 'Create & start timer', exact: true })
    .click();
  await expect(page.locator('.timer-readout')).toContainText('05:30:00Running');
  const localValue = await page.evaluate(() => {
    const target = new Date('2026-11-01T18:30:00+01:00');
    return new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await expect(page.getByLabel('Target date and time')).toHaveValue(localValue);
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
    'invalid calendar date',
    { ...duration, mode: 'datetime', targetDatetime: '2027-02-30T18:00:00Z' },
  ],
  [
    'target without timezone',
    { ...duration, mode: 'datetime', targetDatetime: '2027-01-01T18:00:00' },
  ],
]) {
  test(`rejects ${name} without creating a timer`, async ({ page }) => {
    await setup(page);
    await reply(page, command);
    await record(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create & start timer', exact: true })
    ).toHaveCount(0);
  });
}

test('quota failure is actionable and retry works', async ({ page }) => {
  await setup(page);
  await reply(page, duration, 429);
  await record(page);
  await expect(page.getByRole('alert')).toContainText('quota');
  await page.unroute(endpoint);
  await reply(page);
  await record(page);
  await expect(
    page.getByRole('button', { name: 'Create & start timer', exact: true })
  ).toBeVisible();
});

test('cancel and closing stop recording without uploading; forgetting and reload clear the key', async ({
  page,
}) => {
  let uploads = 0;
  await setup(page);
  await page.route(endpoint, (route) => {
    uploads++;
    return route.abort();
  });
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(2);
  expect(uploads).toBe(0);
  await page.getByRole('button', { name: 'Voice timer', exact: true }).click();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toHaveValue(
    'test-key-not-real'
  );
  await page.getByRole('button', { name: 'Forget key', exact: true }).click();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toBeEmpty();
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('test-key-not-real');
  await page.reload();
  await page.getByRole('button', { name: 'Voice timer', exact: true }).click();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toBeEmpty();
});

test('late microphone permission is cleaned up after the panel closes', async ({
  page,
}) => {
  await setup(page, { pending: true });
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('permission');
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
  await page.evaluate(() => window.voiceTest.allow());
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.stopped))
    .toBe(1);
  expect(await page.evaluate(() => window.voiceTest.recordings)).toBe(0);
});

test('microphone permission denial allows a retry', async ({ page }) => {
  await setup(page, { denied: true });
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('permission was denied');
  await expect(
    page.getByRole('button', { name: 'Record command', exact: true })
  ).toBeEnabled();
});

test('closing during interpretation ignores a late response', async ({
  page,
}) => {
  await setup(page);
  let finish;
  const responseReady = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route(endpoint, async (route) => {
    await responseReady;
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
  await expect(page.getByRole('status')).toContainText('Interpreting');
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
  finish();
  await page.getByRole('button', { name: 'Voice timer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create & start timer', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Record command', exact: true })
  ).toBeEnabled();
});

test('discarding a result leaves existing timers unchanged', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  await record(page);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await expect(page.locator('.timer-readout')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByLabel('Minutes', { exact: true }).fill('0');
  await page.getByLabel('Seconds', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('00:00:10Running');
  await page
    .getByRole('button', { name: 'Voice timer', exact: true })
    .last()
    .click();
  await record(page);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('00:00:10Running');
});

test('automatic recording limit stops the microphone and requests interpretation', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await setup(page);
  await reply(page);
  await page
    .getByRole('button', { name: 'Record command', exact: true })
    .click();
  await page.clock.fastForward(15000);
  await expect(
    page.getByRole('button', { name: 'Create & start timer', exact: true })
  ).toBeVisible();
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

for (const width of [390, 1440]) {
  test(`voice confirmation fits at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await reply(page);
    await record(page);
    await expect(
      page.getByRole('button', { name: 'Create & start timer', exact: true })
    ).toBeVisible();
    const overflow = await page
      .locator('.panel-body')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath('voice-confirmation.png'),
    });
  });
}
