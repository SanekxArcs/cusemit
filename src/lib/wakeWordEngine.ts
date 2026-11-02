import { BuiltInKeyword, PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => {});
  return result;
}
export async function startWakeWord(
  options: {
    accessKey: string;
    keyword: string;
    phrase: string;
    onWake: () => void;
    onFrame: (frame: Int16Array) => void;
    onError: () => void;
  },
  signal: AbortSignal
): Promise<void> {
  let worker: PorcupineWorker | undefined;
  let subscribed = false;
  const engine = {
    onmessage: (event: MessageEvent) => {
      if (!signal.aborted && event.data.command === 'process')
        options.onFrame(event.data.inputFrame);
    },
  };
  const dispose = () =>
    serial(async () => {
      try {
        if (subscribed) {
          subscribed = false;
          await WebVoiceProcessor.unsubscribe(engine);
        }
      } finally {
        if (worker) {
          const previous = worker;
          worker = undefined;
          try {
            await previous.release();
          } finally {
            previous.terminate();
          }
        }
      }
    });
  const onAbort = () => {
    void dispose().catch(() => {});
  };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    await serial(async () => {
      if (signal.aborted) return;
      worker = await PorcupineWorker.create(
        options.accessKey,
        options.keyword
          ? {
              base64: options.keyword,
              label: options.phrase,
              sensitivity: 0.55,
              customWritePath: 'cusemit-wake-keyword',
              forceWrite: true,
            }
          : { builtin: BuiltInKeyword.Computer, sensitivity: 0.55 },
        () => {
          if (!signal.aborted) options.onWake();
        },
        {
          publicPath: '/voice/porcupine_params.pv',
          customWritePath: 'cusemit-porcupine-v4-en',
          version: 1,
        },
        {
          device: 'cpu:1',
          processErrorCallback: () => {
            if (!signal.aborted) options.onError();
          },
        }
      );
      if (signal.aborted) return;
      WebVoiceProcessor.setOptions({
        frameLength: worker.frameLength,
        outputSampleRate: worker.sampleRate,
      });
      engine.onmessage = (event: MessageEvent) => {
        if (signal.aborted || event.data.command !== 'process') return;
        options.onFrame(event.data.inputFrame);
        worker?.process(event.data.inputFrame);
      };
      subscribed = true;
      await WebVoiceProcessor.subscribe(engine);
    });
    if (signal.aborted) await dispose();
  } catch (error) {
    await dispose();
    signal.removeEventListener('abort', onAbort);
    throw error;
  }
}
