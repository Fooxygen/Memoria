# Model Size

Model: `Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9`
License: `apache-2.0`

| Precision | File | Bytes | MB | MiB | Compression vs FP32 |
| --- | --- | ---: | ---: | ---: | ---: |
| FP32 | `onnx/model.onnx` | 90387606 | 90.39 | 86.2 | 1.00x |
| FP16 | `onnx/model_fp16.onnx` | 45297825 | 45.3 | 43.2 | 2.00x |
| INT8 | `onnx/model_quantized.onnx` | 22972370 | 22.97 | 21.91 | 3.93x |

INT8 is 1.97x smaller than FP16.
The runtime loads only the selected ONNX file plus 0.9 MiB of shared tokenizer/config files; the three ONNX files together are not loaded at runtime.
