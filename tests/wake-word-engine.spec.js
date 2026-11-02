import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/lib/wakeWordEngine.ts', import.meta.url),
  'utf8'
);
async function adapter(options = {}) {
  const calls = {
    creates: 0,
    subscribes: 0,
    unsubscribes: 0,
    releases: 0,
    terminates: 0,
    frames: 0,
  };
  const worker = {
    frameLength: 512,
    sampleRate: 16000,
    process: () => {
      calls.frames++;
    },
    release: async () => {
      calls.releases++;
    },
    terminate: () => {
      calls.terminates++;
    },
  };
  globalThis.wakeAdapterFakes = {
    BuiltInKeyword: { Computer: 'Computer' },
    PorcupineWorker: {
      create: async (...args) => {
        calls.creates++;
        calls.createArgs = args;
        if (options.pendingCreate)
          await new Promise((resolve) => {
            calls.allowCreate = resolve;
          });
        return worker;
      },
    },
    WebVoiceProcessor: {
      setOptions: (value) => {
        calls.options = value;
      },
      subscribe: async (engine) => {
        calls.subscribes++;
        calls.engine = engine;
        if (options.pendingSubscribe)
          await new Promise((resolve) => {
            calls.allowSubscribe = resolve;
          });
      },
      unsubscribe: async () => {
        calls.unsubscribes++;
        if (options.unsubscribeFails) throw new Error('failed to unsubscribe');
      },
    },
  };
  const injected =
    source.replace(/import[^;]+from '@picovoice\/[^']+';/g, '') + '\n';
  const javascript = ts.transpileModule(
    'const { BuiltInKeyword, PorcupineWorker, WebVoiceProcessor } = globalThis.wakeAdapterFakes;\n' +
      injected,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }
  ).outputText;
  const module = await import(
    'data:text/javascript;base64,' +
      Buffer.from(javascript).toString('base64') +
      '#' +
      Math.random()
  );
  return { ...module, calls };
}
function config(overrides = {}) {
  return {
    accessKey: 'fake-key',
    phrase: 'Computer',
    keyword: '',
    onWake: () => {},
    onFrame: () => {},
    onError: () => {},
    ...overrides,
  };
}

test('real adapter wires the local worker, PCM frames and cleanup exactly once', async () => {
  const { startWakeWord, calls } = await adapter();
  const controller = new AbortController();
  let wake = 0;
  let frames = 0;
  await startWakeWord(
    config({ onWake: () => wake++, onFrame: () => frames++ }),
    controller.signal
  );
  expect(calls.createArgs[1]).toEqual({
    builtin: 'Computer',
    sensitivity: 0.55,
  });
  expect(calls.createArgs[3].publicPath).toBe('/voice/porcupine_params.pv');
  expect(calls.options).toEqual({ frameLength: 512, outputSampleRate: 16000 });
  calls.createArgs[2]();
  calls.engine.onmessage({
    data: { command: 'process', inputFrame: new Int16Array(512) },
  });
  expect(wake).toBe(1);
  expect(frames).toBe(1);
  expect(calls.frames).toBe(1);
  controller.abort();
  await expect.poll(() => calls.terminates).toBe(1);
  calls.createArgs[2]();
  calls.engine.onmessage({
    data: { command: 'process', inputFrame: new Int16Array(512) },
  });
  expect(wake).toBe(1);
  expect(frames).toBe(1);
  expect(calls.releases).toBe(1);
  expect(calls.unsubscribes).toBe(1);
});

test('aborting pending worker initialization prevents opening the microphone', async () => {
  const { startWakeWord, calls } = await adapter({ pendingCreate: true });
  const controller = new AbortController();
  const starting = startWakeWord(config(), controller.signal);
  await expect.poll(() => calls.creates).toBe(1);
  controller.abort();
  calls.allowCreate();
  await starting;
  expect(calls.subscribes).toBe(0);
  expect(calls.releases).toBe(1);
  expect(calls.terminates).toBe(1);
});

test('late microphone permission is released after cancellation', async () => {
  const { startWakeWord, calls } = await adapter({ pendingSubscribe: true });
  const controller = new AbortController();
  const starting = startWakeWord(
    config({ phrase: 'Hey Clock', keyword: 'AQID' }),
    controller.signal
  );
  await expect.poll(() => calls.subscribes).toBe(1);
  expect(calls.createArgs[1].base64).toBe('AQID');
  expect(calls.createArgs[1].label).toBe('Hey Clock');
  controller.abort();
  calls.allowSubscribe();
  await starting;
  expect(calls.unsubscribes).toBe(1);
  expect(calls.releases).toBe(1);
});

test('worker still terminates if audio unsubscribe fails', async () => {
  const { startWakeWord, calls } = await adapter({ unsubscribeFails: true });
  const controller = new AbortController();
  await startWakeWord(config(), controller.signal);
  controller.abort();
  await expect.poll(() => calls.terminates).toBe(1);
  expect(calls.releases).toBe(1);
});
