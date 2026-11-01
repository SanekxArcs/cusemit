const SAMPLE_RATE = 16000;
const MAX_RECORDING_BYTES = 8 * 1024 * 1024;

export async function prepareVoiceAudio(
  recording: Blob,
  signal: AbortSignal
): Promise<Blob> {
  if (signal.aborted)
    throw new DOMException('Recording cancelled.', 'AbortError');
  if (!recording.size || recording.size > MAX_RECORDING_BYTES)
    throw new Error(
      'The recording is empty or too large. Please record a short command.'
    );

  let decoded: AudioBuffer;
  try {
    const decoder = new OfflineAudioContext(1, 1, SAMPLE_RATE);
    decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
  } catch (failure) {
    if (signal.aborted) throw signal.reason;
    throw new Error(
      'The browser could not read the microphone recording. Please record again or try another browser.'
    );
  }
  if (signal.aborted)
    throw new DOMException('Recording cancelled.', 'AbortError');
  if (decoded.duration < 0.25)
    throw new Error(
      'The recording was too short. Wait for Listening, then say the whole timer command.'
    );
  if (decoded.duration > 20 || !decoded.numberOfChannels)
    throw new Error(
      'The microphone recording has an invalid length. Please record a short command.'
    );

  let samples = decoded.getChannelData(0);
  let energy = 0;
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const candidate = decoded.getChannelData(channel);
    let candidateEnergy = 0;
    for (const sample of candidate) candidateEnergy += sample * sample;
    if (candidateEnergy > energy) {
      samples = candidate;
      energy = candidateEnergy;
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak < 0.00001)
    throw new Error(
      'The microphone recorded silence. Check that it is not muted and that the correct microphone is selected.'
    );

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const wav = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      wav.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  wav.setUint32(4, buffer.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, decoded.sampleRate, true);
  wav.setUint32(28, decoded.sampleRate * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  writeText(36, 'data');
  wav.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    wav.setInt16(44 + index * 2, sample * (sample < 0 ? 32768 : 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
