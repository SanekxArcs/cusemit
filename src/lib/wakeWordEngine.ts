type ResampleState = { sum: number; weight: number };
export function resampleFrame(
  input: Float32Array,
  sampleRate: number,
  state: ResampleState = { sum: 0, weight: 0 }
) {
  const ratio = sampleRate / 16000;
  const output: number[] = [];
  for (const sample of input) {
    let remaining = 1;
    while (remaining > 1e-9) {
      const weight = Math.min(remaining, ratio - state.weight);
      state.sum += sample * weight;
      state.weight += weight;
      remaining -= weight;
      if (state.weight >= ratio - 1e-9) {
        output.push(state.sum / ratio);
        state.sum = 0;
        state.weight = 0;
      }
    }
  }
  return Float32Array.from(output);
}

export async function startWakeWord(
  options: {
    phrase: string;
    onWake: () => void;
    onFrame: (frame: Int16Array) => void;
    onError: () => void;
  },
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return;
  const worker = new Worker('/voice/sherpa/wake-worker.js');
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: ScriptProcessorNode | undefined;
  let disposed = false;
  let pending = 0;
  const resampler: ResampleState = { sum: 0, weight: 0 };
  let rejectReady: ((reason: Error) => void) | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    worker.terminate();
    if (processor) processor.onaudioprocess = null;
    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => {});
    rejectReady?.(new DOMException('Cancelled', 'AbortError'));
    signal.removeEventListener('abort', dispose);
  };
  signal.addEventListener('abort', dispose, { once: true });
  const fail = () => {
    if (disposed) return;
    dispose();
    options.onError();
  };
  try {
    await new Promise<void>((resolve, reject) => {
      rejectReady = reject;
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.onmessage = (event: MessageEvent) => {
        if (disposed) return;
        if (event.data.type === 'ready') resolve();
        else if (event.data.type === 'processed') pending = Math.max(0, pending - 1);
        else if (event.data.type === 'wake') options.onWake();
        else if (event.data.type === 'error') fail();
      };
      worker.postMessage({ type: 'init', phrase: options.phrase });
    });
    rejectReady = undefined;
    if (disposed) return;
    const captured = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    if (disposed) {
      captured.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = captured;
    stream.getAudioTracks().forEach((track) =>
      track.addEventListener('ended', fail, { once: true })
    );
    context = new AudioContext();
    await context.resume();
    if (disposed) return;
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      if (disposed || !context) return;
      const samples = resampleFrame(
        event.inputBuffer.getChannelData(0), context.sampleRate, resampler
      );
      const pcm = Int16Array.from(samples, (sample) =>
        Math.round(Math.max(-1, Math.min(1, sample)) * 32767)
      );
      options.onFrame(pcm);
      if (disposed) return;
      if (pending >= 12) {
        fail();
        return;
      }
      pending++;
      worker.postMessage({ type: 'audio', samples }, [samples.buffer]);
    };
    source.connect(processor);
    processor.connect(context.destination);
  } catch (error) {
    dispose();
    if (!signal.aborted) throw error;
  }
}
