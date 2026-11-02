# Speech fixture

sherpa-kws.wav is the unmodified test_wavs/0.wav from the official Apache-2.0 keyword model archive:
https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2

Archive SHA256 and licensing: ../../public/voice/sherpa/NOTICE.md and LICENSE.
Upstream transcript: AFTER EARLY NIGHTFALL THE YELLOW LAMPS WOULD LIGHT UP HERE AND THERE THE SQUALID QUARTER OF THE BROTHELS.

The real-WASM regression substitutes the upstream tokenized keyword “light up” in the worker for this test only. Production preset recognition accuracy is not established by this fixture.

