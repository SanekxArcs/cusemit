import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/lib/handsFreeAudio.ts', import.meta.url),
  'utf8'
);
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { SilenceRecorder, frameLevel } = await import(
  'data:text/javascript;base64,' + Buffer.from(javascript).toString('base64')
);
const voice = () =>
  Int16Array.from({ length: 512 }, (_, index) => Math.sin(index * 0.17) * 6000);
const quiet = () => new Int16Array(512);
function feed(recorder, frame, count) {
  let result;
  for (let index = 0; index < count; index++) result = recorder.push(frame());
  return result;
}

for (const silenceMs of [1000, 1500, 3000]) {
  test('stops after configured silence, not before: ' + silenceMs, () => {
    const recorder = new SilenceRecorder(silenceMs, 0.006);
    expect(feed(recorder, voice, 10)).toBe('recording');
    const frames = Math.ceil(silenceMs / 32);
    expect(feed(recorder, quiet, frames - 1)).toBe('recording');
    expect(recorder.push(quiet())).toBe('ready');
  });
}

test('a pause shorter than 1.5s does not finish and new speech resets silence', () => {
  const recorder = new SilenceRecorder(1500, 0.006);
  feed(recorder, voice, 10);
  expect(feed(recorder, quiet, 40)).toBe('recording');
  recorder.push(voice());
  expect(feed(recorder, quiet, 46)).toBe('recording');
  expect(recorder.push(quiet())).toBe('ready');
});

test('no speech and brief clicks are discarded after five seconds', () => {
  for (const voiced of [0, 1, 6]) {
    const recorder = new SilenceRecorder(1500, 0.006);
    feed(recorder, voice, voiced);
    expect(feed(recorder, quiet, 157 - voiced)).toBe('empty');
    expect(recorder.finish()).toBeNull();
  }
});

test('continuous sound is bounded to fifteen seconds', () => {
  const recorder = new SilenceRecorder(1500, 0.006);
  expect(feed(recorder, voice, 468)).toBe('recording');
  expect(recorder.push(voice())).toBe('ready');
});

test('ambient energy below the noise threshold is not treated as speech', () => {
  const recorder = new SilenceRecorder(1500, 0.02);
  expect(feed(recorder, () => new Int16Array(512).fill(100), 157)).toBe(
    'empty'
  );
});

test('output is complete little-endian mono PCM WAV and captures copied frames', async () => {
  const recorder = new SilenceRecorder(1500, 0.006);
  const frame = voice();
  for (let index = 0; index < 10; index++) recorder.push(frame);
  frame.fill(0);
  const wav = Buffer.from(await recorder.finish().arrayBuffer());
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
  expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  expect(wav.readUInt32LE(24)).toBe(16000);
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.readUInt32LE(40)).toBe(10 * 512 * 2);
  expect(wav.readInt16LE(46)).not.toBe(0);
  expect(frameLevel(quiet())).toBe(0);
  expect(frameLevel(voice())).toBeGreaterThan(0.1);
});
