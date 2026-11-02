const phrases = {
  Computer: '▁COMP U TER',
  'Hey Clock': '▁HE Y ▁C LO CK',
  'Hey Cusemit': '▁HE Y ▁C U SE M IT',
};
let recognizer;
let stream;
let initializing = false;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      if (initializing || !phrases[data.phrase]) throw new Error('Invalid wake phrase');
      initializing = true;
      importScripts('sherpa-onnx-wasm-web.js', 'sherpa-onnx-kws.js');
      const module = await SherpaOnnx({
        locateFile: (name) => '/voice/sherpa/' + name,
        print: () => {},
        printErr: () => {},
      });
      await Promise.all(['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'].map(async (name) => {
        const response = await fetch('/voice/sherpa/' + name);
        if (!response.ok) throw new Error('Could not load ' + name);
        module.FS.writeFile('/' + name, new Uint8Array(await response.arrayBuffer()));
      }));
      module.FS.writeFile('/keywords.txt', phrases[data.phrase] + ' @' + data.phrase.replaceAll(' ', '_') + '\n');
      recognizer = createKws(module, {
        featConfig: { samplingRate: 16000, featureDim: 80 },
        modelConfig: {
          transducer: { encoder: '/encoder.int8.onnx', decoder: '/decoder.int8.onnx', joiner: '/joiner.int8.onnx' },
          tokens: '/tokens.txt', provider: 'cpu', numThreads: 1, debug: 0, modelingUnit: 'bpe',
        },
        maxActivePaths: 4, numTrailingBlanks: 1, keywordsScore: 1.5,
        keywordsThreshold: 0.25, keywords: '/keywords.txt',
      });
      if (!recognizer.handle) throw new Error('Could not create keyword spotter');
      stream = recognizer.createStream();
      if (!stream.handle) throw new Error('Could not create keyword stream');
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'audio' && stream) {
      stream.acceptWaveform(16000, data.samples);
      while (recognizer.isReady(stream)) {
        recognizer.decode(stream);
        if (recognizer.getResult(stream).keyword) {
          recognizer.reset(stream);
          self.postMessage({ type: 'wake' });
        }
      }
      self.postMessage({ type: 'processed' });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
    self.close();
  }
};
