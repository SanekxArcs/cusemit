import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/wakeWordEngine.ts', import.meta.url), 'utf8');
async function adapter(options = {}) {
  const calls = { stops: 0, terminates: 0, closes: 0, frames: 0, wakes: 0, errors: 0, microphones: 0 };
  const track = { stop: () => calls.stops++, addEventListener: (name, callback) => { calls.trackEnded = callback; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class FakeWorker {
    constructor() { calls.worker = this; }
    postMessage(data) {
      if (data.type === 'init') {
        calls.phrase = data.phrase;
        calls.ready = () => this.onmessage({ data: { type: 'ready' } });
        if (!options.pendingInit) queueMicrotask(calls.ready);
      } else {
        calls.samples = data.samples;
        if (!options.slowWorker) queueMicrotask(() => this.onmessage({ data: { type: 'processed' } }));
      }
    }
    terminate() { calls.terminates++; }
  }
  class FakeAudioContext {
    sampleRate = 48000;
    resume() { return Promise.resolve(); }
    close() { calls.closes++; return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() {
      calls.processor = { connect() {}, disconnect() {} };
      return calls.processor;
    }
  }
  globalThis.wakeAdapterFakes = {
    Worker: FakeWorker, AudioContext: FakeAudioContext,
    navigator: { mediaDevices: { getUserMedia: async () => {
      calls.microphones++;
      if (options.pendingPermission) await new Promise(resolve => { calls.allowPermission = resolve; });
      return stream;
    } } },
  };
  const javascript = ts.transpileModule(
    'const { Worker, AudioContext, navigator } = globalThis.wakeAdapterFakes;\n' + source,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }
  ).outputText;
  const loaded = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64') + '#' + Math.random());
  const controller = new AbortController();
  const start = () => loaded.startWakeWord({
    phrase: 'Hey Clock', onWake: () => calls.wakes++, onFrame: () => calls.frames++, onError: () => calls.errors++,
  }, controller.signal);
  const audio = () => calls.processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(0.2) } });
  return { ...loaded, calls, controller, start, audio };
}

test('resampling preserves 16 kHz sample count across 48 kHz block boundaries', async () => {
  const { resampleFrame } = await adapter();
  const state = { sum: 0, weight: 0 };
  let count = 0;
  for (let frame = 0; frame < 300; frame++) {
    const result = resampleFrame(new Float32Array(2048).fill(0.3), 48000, state);
    count += result.length;
    expect(result[0]).toBeCloseTo(0.3);
  }
  expect(count).toBe(204800);
});

test('adapter sends PCM and wake events, then releases resources exactly once', async () => {
  const state = await adapter();
  await state.start();
  expect(state.calls.phrase).toBe('Hey Clock');
  state.calls.worker.onmessage({ data: { type: 'wake' } });
  state.audio();
  expect(state.calls.frames).toBe(1);
expect(state.calls.samples.length).toBe(682);
  state.controller.abort();
  state.calls.worker.onmessage({ data: { type: 'wake' } });
  expect(state.calls.wakes).toBe(1);
  expect(state.calls.terminates).toBe(1);
  expect(state.calls.stops).toBe(1);
  expect(state.calls.closes).toBe(1);
  expect(state.calls.processor.onaudioprocess).toBeNull();
});

test('abort while loading terminates worker without requesting microphone', async () => {
  const state = await adapter({ pendingInit: true });
  const starting = state.start();
  state.controller.abort();
  await starting;
  state.calls.ready();
  expect(state.calls.microphones).toBe(0);
  expect(state.calls.terminates).toBe(1);
});

test('late microphone permission is released after cancellation', async () => {
  const state = await adapter({ pendingPermission: true });
  const starting = state.start();
  await expect.poll(() => state.calls.microphones).toBe(1);
  state.controller.abort();
  state.calls.allowPermission();
  await starting;
  expect(state.calls.stops).toBe(1);
  expect(state.calls.closes).toBe(0);
});

test('worker failure during initialization rejects and closes it', async () => {
  const state = await adapter({ pendingInit: true });
  const starting = state.start();
  const rejected = expect(starting).rejects.toThrow('Cancelled');
  state.calls.worker.onerror();
  await rejected;
  expect(state.calls.errors).toBe(1);
  expect(state.calls.terminates).toBe(1);
});

test('slow inference has a bounded audio queue and stops the microphone', async () => {
  const state = await adapter({ slowWorker: true });
  await state.start();
  for (let frame = 0; frame < 15; frame++) state.audio();
  expect(state.calls.errors).toBe(1);
  expect(state.calls.stops).toBe(1);
  expect(state.calls.terminates).toBe(1);
});

test('an ended audio track disables the engine and frees resources', async () => {
  const state = await adapter();
  await state.start();
  state.calls.trackEnded();
  expect(state.calls.errors).toBe(1);
  expect(state.calls.stops).toBe(1);
  expect(state.calls.closes).toBe(1);
});
