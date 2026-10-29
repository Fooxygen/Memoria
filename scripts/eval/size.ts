// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface ModelLock {
    model:     string;
    directory: string;
    revision:  string;
    license?:  string;
    source?:   string;
    files:     Record<string, { size: number; sha256: string }>;
}

const LOCK_PATH = "scripts/model/models.lock.json";
const MODEL_ROOT = "data/models";
const OUT_DIR = "bench/results";

function mb(bytes: number): number {
    return Number((bytes / 1_000_000).toFixed(2));
}

function mib(bytes: number): number {
    return Number((bytes / 1_048_576).toFixed(2));
}

async function main(): Promise<void> {
    const lock = JSON.parse(await readFile(LOCK_PATH, "utf8")) as ModelLock;
    const root = join(MODEL_ROOT, lock.directory);

    const files: Record<string, { bytes: number; mb: number; mib: number }> = {};
    for (const [name, meta] of Object.entries(lock.files)) {
        const info = await stat(join(root, name));
        files[name] = { bytes: info.size, mb: mb(info.size), mib: mib(info.size) };
        if (info.size !== meta.size) {
            throw new Error(`${name} size mismatch: ${info.size} !== ${meta.size}`);
        }
    }

    const fp32 = files["onnx/model.onnx"];
    const fp16 = files["onnx/model_fp16.onnx"];
    const int8 = files["onnx/model_quantized.onnx"];
    if (!fp32 || !fp16 || !int8) throw new Error("missing ONNX files");

    const shared_bytes = Object.entries(files)
        .filter(([name]) => !name.startsWith("onnx/"))
        .reduce((total, [, info]) => total + info.bytes, 0);

    const result = {
        generated_at: new Date().toISOString(),
        model:        lock.model,
        revision:     lock.revision,
        license:      lock.license,
        source:       lock.source,
        files,
        compression: {
            int8_vs_fp32: Number((fp32.bytes / int8.bytes).toFixed(2)),
            fp16_vs_fp32: Number((fp32.bytes / fp16.bytes).toFixed(2)),
            int8_vs_fp16: Number((fp16.bytes / int8.bytes).toFixed(2)),
        },
        deployment: {
            shared_bytes,
            int8_bytes: Number((shared_bytes + int8.bytes).toFixed(0)),
            fp16_bytes: Number((shared_bytes + fp16.bytes).toFixed(0)),
            fp32_bytes: Number((shared_bytes + fp32.bytes).toFixed(0)),
        },
    };

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, "model-size.json"), `${JSON.stringify(result, null, 2)}\n`);

    const markdown = `# Model Size

Model: \`${lock.model}@${lock.revision}\`
License: \`${lock.license}\`

| Precision | File | Bytes | MB | MiB | Compression vs FP32 |
| --- | --- | ---: | ---: | ---: | ---: |
| FP32 | \`onnx/model.onnx\` | ${fp32.bytes} | ${fp32.mb} | ${fp32.mib} | 1.00x |
| FP16 | \`onnx/model_fp16.onnx\` | ${fp16.bytes} | ${fp16.mb} | ${fp16.mib} | ${result.compression.fp16_vs_fp32.toFixed(2)}x |
| INT8 | \`onnx/model_quantized.onnx\` | ${int8.bytes} | ${int8.mb} | ${int8.mib} | ${result.compression.int8_vs_fp32.toFixed(2)}x |

INT8 is ${result.compression.int8_vs_fp16.toFixed(2)}x smaller than FP16.
The runtime loads only the selected ONNX file plus ${mib(shared_bytes)} MiB of shared tokenizer/config files; the three ONNX files together are not loaded at runtime.
`;
    await writeFile(join(OUT_DIR, "model-size.md"), markdown);

    console.log(markdown);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
