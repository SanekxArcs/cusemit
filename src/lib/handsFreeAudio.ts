export class SilenceRecorder {
  private frames: Int16Array[] = [];
  private samples = 0;
  private voicedSamples = 0;
  private quietSamples = 0;
  constructor(
    private silenceMs: number,
    private threshold: number,
    private sampleRate = 16000
  ) {}
  push(frame: Int16Array): 'recording' | 'ready' | 'empty' {
    this.frames.push(frame.slice());
    this.samples += frame.length;
    const audible = frameLevel(frame) >= this.threshold;
    if (audible) {
      this.voicedSamples += frame.length;
      this.quietSamples = 0;
    } else this.quietSamples += frame.length;
    const hasSpeech = this.voicedSamples >= this.sampleRate * 0.2;
    if (
      hasSpeech &&
      this.quietSamples >= (this.sampleRate * this.silenceMs) / 1000
    )
      return 'ready';
    if (this.samples >= this.sampleRate * 15)
      return hasSpeech ? 'ready' : 'empty';
    if (!hasSpeech && this.samples >= this.sampleRate * 5) return 'empty';
    return 'recording';
  }
  finish(): Blob | null {
    if (this.voicedSamples < this.sampleRate * 0.2) return null;
    const buffer = new ArrayBuffer(44 + this.samples * 2);
    const view = new DataView(buffer);
    const text = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index++)
        view.setUint8(offset + index, value.charCodeAt(index));
    };
    text(0, 'RIFF');
    view.setUint32(4, buffer.byteLength - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, this.samples * 2, true);
    let offset = 44;
    for (const frame of this.frames)
      for (const sample of frame) {
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    return new Blob([buffer], { type: 'audio/wav' });
  }
}
export function frameLevel(frame: Int16Array): number {
  let energy = 0;
  for (const sample of frame) energy += (sample / 32768) ** 2;
  return Math.sqrt(energy / Math.max(1, frame.length));
}
