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
    if (options.delayedDecode) {
      const NativeDecoder = window.OfflineAudioContext;
      window.OfflineAudioContext = class extends NativeDecoder {
        decodeAudioData(bytes) {
          return new Promise((resolve, reject) => {
            window.voiceTest.finishDecoding = () =>
              super.decodeAudioData(bytes).then(resolve, reject);
          });
        }
      };
    }
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
        if (options.realRecorder) {
          const context = new AudioContext();
          const destination = context.createMediaStreamDestination();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.value = options.silence ? 0 : 0.2;
          oscillator.frequency.value = 440;
          oscillator.connect(gain).connect(destination);
          oscillator.start();
          await context.resume();
          for (const track of destination.stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => {
              window.voiceTest.stopped++;
              oscillator.stop();
              void context.close();
              stop();
            };
          }
          return destination.stream;
        }
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
    if (options.realRecorder) {
      const NativeRecorder = window.MediaRecorder;
      window.MediaRecorder = class extends NativeRecorder {
        constructor(input, config) {
          super(input, config);
          this.addEventListener('dataavailable', () => {
            window.voiceTest.chunks = (window.voiceTest.chunks || 0) + 1;
          });
        }
      };
      return;
    }
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
        const sampleRate = 16000;
        const length = options.short ? 1600 : sampleRate;
        const channels = options.stereo ? 2 : 1;
        const buffer = new ArrayBuffer(44 + length * channels * 2);
        const view = new DataView(buffer);
        const text = (offset, value) => {
          for (let index = 0; index < value.length; index++)
            view.setUint8(offset + index, value.charCodeAt(index));
        };
        text(0, 'RIFF');
        view.setUint32(4, buffer.byteLength - 8, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channels * 2, true);
        view.setUint16(32, channels * 2, true);
        view.setUint16(34, 16, true);
        text(36, 'data');
        view.setUint32(40, buffer.byteLength - 44, true);
        for (let index = 0; index < length; index++) {
          const sample = options.silence
            ? 0
            : Math.round(
                Math.sin((index * 2 * Math.PI * 440) / sampleRate) *
                  (options.quiet ? 3 : 6000)
              );
          view.setInt16(
            44 + (index * channels + channels - 1) * 2,
            sample,
            true
          );
        }
        this.ondataavailable?.({
          data: new Blob([options.corrupt ? 'invalid-audio' : buffer], {
            type: this.mimeType,
          }),
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

for (const mode of ['cancel_last', 'cancel_all']) {
  test(mode + ' removes selected timers and Undo restores their identity and progress', async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: 'Timers', exact: true }).click();
    await page.getByRole('button', { name: 'Add timer' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Add timer' }).click();
    await page.getByRole('button', { name: 'Close settings' }).click();
    const original = await timers(page);
    await page.clock.setFixedTime(new Date('2026-11-01T12:01:00Z'));
    await reply(page, { ...duration, transcript: mode === 'cancel_all' ? 'cancel all timers' : 'cancel last timer', mode, durationSeconds: 0 });
    await record(page);
    const notice = notices(page).filter({ hasText: mode === 'cancel_all' ? '2 timers cancelled' : 'Timer cancelled:' });
    await expect(notice).toBeVisible();
    await expect.poll(async () => (await timers(page)).map((timer) => timer.id)).toEqual(mode === 'cancel_all' ? [] : [original[0].id]);
    await notice.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => timers(page)).toEqual(original);
    await page.getByRole('button', { name: 'Timers', exact: true }).click();
    await expect(page.locator('.timer-readout').first()).toContainText('00:04:00Running');
    await expect(page.locator('.timer-readout').nth(1)).not.toContainText('Running');
  });

  test(mode + ' with no timers does not create a timer', async ({ page }) => {
    await setup(page);
    await reply(page, { ...duration, mode, durationSeconds: 0 });
    await record(page);
    await expect(notices(page)).toContainText('No timers to cancel');
    expect(await timers(page)).toEqual([]);
  });
}

test('Undo cancellation preserves timers created afterwards', async ({ page }) => {
  await setup(page);
  await reply(page);
  await record(page);
  await expect.poll(() => timers(page)).toHaveLength(1);
  const original = (await timers(page))[0];
  await reply(page, { ...duration, mode: 'cancel_all', transcript: 'cancel all timers' });
  await record(page);
  const notice = notices(page).filter({ hasText: 'Timer cancelled:' });
  await expect(notice).toBeVisible();
  await reply(page, { ...duration, label: 'New timer' });
  await record(page);
  await expect(notices(page).filter({ hasText: 'Timer started: New timer' })).toBeVisible();
  const newer = (await timers(page))[0];
  await notices(page).filter({ hasText: 'Timer started: New timer' }).hover();
  await expect(notice).toHaveAttribute('data-expanded', 'true');
  await notice.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => timers(page)).toEqual([original, newer]);
});

test('tap recording auto-starts a timer, persists the key, and Undo removes it', async ({
  page,
}) => {
  await setup(page);
  await reply(page);
  const sent = page.waitForRequest(endpoint);
  await record(page);
  const request = await sent;
  expect(request.headers()['x-goog-api-key']).toBe('test-key-not-real');
  expect(request.url()).not.toContain('test-key');
  const audio = request.postDataJSON().contents[0].parts[1].inlineData;
  const wav = Buffer.from(audio.data, 'base64');
  expect(audio.mimeType).toBe('audio/wav');
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.readUInt32LE(24)).toBe(16000);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
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
  ).toContain('test-key-not-real');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.timer-readout')).toHaveCount(0);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

for (const [sound, expected] of [['on', 'chime'], ['off', 'none'], [undefined, 'chime']]) {
  test('voice sound preference ' + sound + ' and auto-delete survive timer expiry', async ({ page }) => {
    await setup(page);
    await reply(page, { ...duration, durationSeconds: 5, sound });
    const sent = page.waitForRequest(endpoint);
    await record(page);
    const body = (await sent).postDataJSON();
    expect(body.generationConfig.responseSchema.properties.sound.enum).toEqual(['default', 'on', 'off']);
    expect(body.generationConfig.responseSchema.required).toContain('sound');
    await expect(notices(page)).toContainText('Timer started: Чай');
    expect((await timers(page))[0]).toMatchObject({ autoDelete: true, alarmSound: expected });
    await page.getByRole('button', { name: 'Timers', exact: true }).click();
    await expect(page.locator('.timer-readout')).toContainText('Running');
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:06Z'));
    await expect.poll(() => timers(page)).toHaveLength(0);
    if (expected === 'chime') {
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.keyboard.press('Space');
      await expect(page.getByRole('alertdialog')).toBeHidden();
    } else {
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
    }
  });
}

test('invalid sound preference cannot create a timer', async ({ page }) => {
  await setup(page);
  await reply(page, { ...duration, sound: 'loud' });
  await record(page);
  await expect(notices(page)).toContainText('invalid sound preference');
  expect(await timers(page)).toHaveLength(0);
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

test('cancel and settings release the microphone without uploading; Forget key survives reload', async ({
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

test('hold release sends once, mode and key persist with automatic verification', async ({
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
  await expect(page.getByLabel('Gemini API key', { exact: true })).toHaveValue('test-key-not-real');
  await expect(page.getByRole('button', { name: 'Key verified' })).toBeVisible();
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

for (const label of ['', undefined]) {
  test(
    'audible timer without a name starts with a fallback name: ' +
      String(label),
    async ({ page }) => {
      await setup(page);
      await reply(page, { ...duration, label });
      await record(page);
      await expect(notices(page)).toContainText('Timer started: Timer');
      expect((await timers(page))[0].label).toBe('Timer');
    }
  );
}

test('unclear command shows what Gemini actually heard instead of claiming microphone silence', async ({
  page,
}) => {
  await setup(page);
  await reply(page, {
    ...duration,
    transcript: 'Hello everyone',
    mode: 'unclear',
  });
  await record(page);
  await expect(notices(page)).toContainText('Heard “Hello everyone”');
  expect(await timers(page)).toHaveLength(0);
});

for (const [name, options, message] of [
  ['silence', { silence: true }, 'microphone recorded silence'],
  ['short recording', { short: true }, 'recording was too short'],
  [
    'corrupt recording',
    { corrupt: true },
    'could not read the microphone recording',
  ],
]) {
  test(
    name + ' is detected locally without sending audio or invalidating the key',
    async ({ page }) => {
      await setup(page, options);
      let uploads = 0;
      await page.route(endpoint, (route) => {
        uploads++;
        return route.abort();
      });
      await record(page);
      await expect(notices(page)).toContainText(message);
      expect(uploads).toBe(0);
      expect(await timers(page)).toHaveLength(0);
      await expect(
        page.getByRole('button', { name: 'Record command' })
      ).toBeEnabled();
    }
  );
}

for (const options of [{ quiet: true }, { stereo: true }]) {
  test(
    'quiet or secondary-channel audio is preserved: ' + JSON.stringify(options),
    async ({ page }) => {
      await setup(page, options);
      await reply(page);
      const sent = page.waitForRequest(endpoint);
      await record(page);
      const wav = Buffer.from(
        (await sent).postDataJSON().contents[0].parts[1].inlineData.data,
        'base64'
      );
      let peak = 0;
      for (let offset = 44; offset < wav.length; offset += 2)
        peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
      expect(peak).toBeGreaterThan(0);
      await expect(notices(page)).toContainText('Timer started');
    }
  );
}

test('native MediaRecorder WebM chunks are decoded into audible complete PCM WAV before upload', async ({
  page,
}) => {
  await setup(page, { realRecorder: true });
  await reply(page);
  const sent = page.waitForRequest(endpoint);
  await page.getByRole('button', { name: 'Record command' }).click();
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.chunks || 0))
    .toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Stop & interpret' }).click();
  const audio = (await sent).postDataJSON().contents[0].parts[1].inlineData;
  const wav = Buffer.from(audio.data, 'base64');
  expect(audio.mimeType).toBe('audio/wav');
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.readUInt32LE(24)).toBe(16000);
  const samples = (wav.length - 44) / 2;
  expect(samples / 16000).toBeGreaterThan(0.8);
  let energy = 0;
  for (let offset = 44; offset < wav.length; offset += 2)
    energy += (wav.readInt16LE(offset) / 32768) ** 2;
  expect(Math.sqrt(energy / samples)).toBeGreaterThan(0.05);
  expect(
    await page.evaluate(() => window.voiceTest.chunks)
  ).toBeGreaterThanOrEqual(2);
  await expect(notices(page)).toContainText('Timer started');
});

test('audio request error does not revoke a verified key', async ({ page }) => {
  await setup(page);
  await reply(page, duration, 400);
  await record(page);
  await expect(notices(page)).toContainText(
    'could not process the audio request'
  );
  await expect(
    page.getByRole('button', { name: 'Record command' })
  ).toBeEnabled();
});

test('cancel during local decoding discards audio without uploading a late result', async ({
  page,
}) => {
  await setup(page, { delayedDecode: true });
  let uploads = 0;
  await page.route(endpoint, (route) => {
    uploads++;
    return route.abort();
  });
  await record(page);
  await expect
    .poll(() => page.evaluate(() => typeof window.voiceTest.finishDecoding))
    .toBe('function');
  await page.getByRole('button', { name: 'Cancel voice timer' }).click();
  await page.evaluate(() => window.voiceTest.finishDecoding());
  await expect(
    page.getByRole('button', { name: 'Record command' })
  ).toBeEnabled();
  expect(uploads).toBe(0);
  expect(await timers(page)).toHaveLength(0);
});

test('missing transcription is not mistaken for a valid unnamed timer', async ({
  page,
}) => {
  await setup(page);
  await reply(page, { ...duration, transcript: '', label: '' });
  await record(page);
  await expect(notices(page)).toContainText('Gemini could not transcribe');
  expect(await timers(page)).toHaveLength(0);
});

test('invalid API key in an HTTP 400 response still hides the microphone', async ({
  page,
}) => {
  await setup(page);
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { details: [{ reason: 'API_KEY_INVALID' }] },
      }),
    })
  );
  await record(page);
  await expect(notices(page)).toContainText('Gemini rejected this API key');
  await expect(page.locator('.voice-dock')).toHaveCount(0);
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
