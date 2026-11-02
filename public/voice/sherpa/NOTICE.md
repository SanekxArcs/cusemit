# Local keyword spotting assets

Runtime: official sherpa_onnx_web 2.0.1 package, Apache-2.0.
Source: https://pub.dev/api/archives/sherpa_onnx_web-2.0.1.tar.gz
SHA256: 38dce9890b22227c4a18c35cd09205435efcad6bd3ef788f9065673385a967dc
Upstream: https://github.com/k2-fsa/sherpa-onnx/tree/v2.0.1
Unmodified assets: sherpa-onnx-wasm-web.js, sherpa-onnx-wasm-web.wasm, sherpa-onnx-kws.js.

Model: sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01, Apache-2.0 per bundled model card.
Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2
SHA256: f170013b4716e41b62b9bfd809687c207cef798ef9bc6534d524e17af9b6561a
Unmodified int8 encoder/decoder/joiner renamed from the matching *-epoch-12-avg-2-chunk-16-left-64.int8.onnx files. tokens.txt is unmodified.
Model card: https://www.modelscope.cn/models/pkufool/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01

Preset token sequences were generated with SentencePiece 0.2.1 from the archive's bpe.model, using uppercase phrase text. No user voice recordings or remote training are needed. Current presets: Computer (▁COMP U TER), Hey Clock (▁HE Y ▁C LO CK), One Plus (▁ONE ▁P LU S).

LICENSE contains the Apache-2.0 license distributed with the runtime. wake-worker.js is the app-owned integration, not an upstream file.
