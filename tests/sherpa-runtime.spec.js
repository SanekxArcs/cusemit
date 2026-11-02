import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });
for (const phrase of ['Computer', 'Hey Clock', 'One Plus']) {
  test('real local sherpa WASM initializes preset: ' + phrase, async ({ page }) => {
    await page.goto('/');
    const messages = await page.evaluate(async (phrase) => {
      const worker = new Worker('/voice/sherpa/wake-worker.js');
      try {
        return await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WASM startup timed out')), 45000);
          worker.onerror = (error) => { clearTimeout(timeout); reject(new Error(error.message)); };
          worker.onmessage = ({ data }) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(new Error(data.message)); }
            if (data.type === 'ready') worker.postMessage({ type: 'audio', samples: new Float32Array(16000) });
            if (data.type === 'processed') { clearTimeout(timeout); resolve(data.type); }
          };
          worker.postMessage({ type: 'init', phrase });
        });
      } finally { worker.terminate(); }
    }, phrase);
    expect(messages).toBe('processed');
  });
}

test('real local inference detects an upstream speech fixture', async ({ page }) => {
  const source = await readFile(new URL('../public/voice/sherpa/wake-worker.js', import.meta.url), 'utf8');
  const speech = await readFile(new URL('./fixtures/sherpa-kws.wav', import.meta.url));
  await page.route('**/voice/sherpa/wake-worker.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: source.replace("Computer: '▁COMP U TER'", "Computer: '▁ L IGHT ▁UP'"),
  }));
  await page.route('**/test-speech.wav', route => route.fulfill({ contentType: 'audio/wav', body: speech }));
  await page.goto('/');
  const wakes = await page.evaluate(async () => {
    const bytes = await (await fetch('/test-speech.wav')).arrayBuffer();
    const audio = new AudioContext({ sampleRate: 16000 });
    const decoded = await audio.decodeAudioData(bytes);
    const samples = decoded.getChannelData(0).slice();
    await audio.close();
    const worker = new Worker('/voice/sherpa/wake-worker.js');
    try {
      return await new Promise((resolve, reject) => {
        let wakes = 0;
        const timeout = setTimeout(() => reject(new Error('Inference timed out')), 45000);
        worker.onerror = (error) => { clearTimeout(timeout); reject(new Error(error.message)); };
        worker.onmessage = ({ data }) => {
          if (data.type === 'error') { clearTimeout(timeout); reject(new Error(data.message)); }
          if (data.type === 'ready') {
            const padded = new Float32Array(samples.length + 16000);
            padded.set(samples);
            worker.postMessage({ type: 'audio', samples: padded });
          }
          if (data.type === 'wake') wakes++;
          if (data.type === 'processed') { clearTimeout(timeout); resolve(wakes); }
        };
        worker.postMessage({ type: 'init', phrase: 'Computer' });
      });
    } finally { worker.terminate(); }
  });
  expect(wakes).toBeGreaterThan(0);
});

test('real adapter captures 16 kHz PCM and releases its microphone on stop', async ({ page }) => {
  const chunks = await readdir(new URL('../dist/assets/', import.meta.url));
  const chunk = chunks.find(name => /^wakeWordEngine-.*\.js$/.test(name));
  expect(chunk).toBeTruthy();
  await page.goto('/');
  await page.mouse.click(10, 10);
  const result = await page.evaluate(async (chunk) => {
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    const microphone = destination.stream.getAudioTracks()[0];
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
    const { startWakeWord } = await import('/assets/' + chunk);
    const controller = new AbortController();
    let frames = 0;
    let largest = 0;
    let failure = false;
    let frameReady;
    const heard = new Promise(resolve => { frameReady = resolve; });
    try {
      await startWakeWord({
        phrase: 'Hey Clock', onWake: () => {}, onError: () => { failure = true; frameReady(); },
        onFrame: (pcm) => {
          frames++;
          for (const sample of pcm) largest = Math.max(largest, Math.abs(sample));
          if (frames >= 4) frameReady();
        },
      }, controller.signal);
      await Promise.race([
        heard,
        new Promise((_, reject) => setTimeout(() => reject(new Error('No microphone frames')), 5000)),
      ]);
    } finally {
      controller.abort();
      oscillator.stop();
      await audio.close();
    }
    return { frames, largest, failure, stopped: microphone.readyState === 'ended' };
  }, chunk);
  expect(result.frames).toBeGreaterThanOrEqual(4);
  expect(result.largest).toBeGreaterThan(1000);
  expect(result.failure).toBe(false);
  expect(result.stopped).toBe(true);
});
