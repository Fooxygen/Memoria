// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { get as http_get } from "node:http";
import { get as https_get } from "node:https";
import type { IncomingMessage } from "node:http";
import { dirname, join, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

type Dtype = "int8" | "fp16" | "fp32" | "all";

interface ModelFile {
    size:   number;
    sha256: string;
}

interface ModelLock {
    model:     string;
    directory: string;
    revision:  string;
    license?:  string;
    source?:   string;
    files:     Record<string, ModelFile>;
}

interface Args {
    check:    boolean;
    force:    boolean;
    dtype:    Dtype;
    output:   string;
    endpoint: string;
}

const LOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), "models.lock.json");

const RUNTIME_FILES = [
    "config.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.txt",
] as const;

const ONNX_FILES: Record<Exclude<Dtype, "all">, string> = {
    int8: "onnx/model_quantized.onnx",
    fp16: "onnx/model_fp16.onnx",
    fp32: "onnx/model.onnx",
};

function usage(): string {
    return `
用法：npm run model:fetch -- [options]

选项：
  --check              只校验本地文件，不下载
  --dtype <type>       int8（默认）| fp16 | fp32 | all
  --output <dir>       模型根目录，默认 data/models
  --endpoint <url>     下载源，默认 https://huggingface.co
  --force              即使文件校验通过也重新下载
  -h, --help           显示帮助

示例：
  npm run model:fetch
  npm run model:fetch -- --dtype all
  npm run model:check
`.trim();
}

function is_dtype(value: string | undefined): value is Dtype {
    return value === "int8" || value === "fp16" || value === "fp32" || value === "all";
}

function args_parse(argv: string[]): Args {
    const args: Args = {
        check:    false,
        force:    false,
        dtype:    "int8",
        output:   process.env.MEMORIA_MODEL_ROOT ?? "data/models",
        endpoint: process.env.HF_ENDPOINT ?? "https://huggingface.co",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === "--check") {
            args.check = true;
        }
        else if (arg === "--force") {
            args.force = true;
        }
        else if (arg === "--dtype") {
            const value = argv[++i];
            if (!is_dtype(value)) throw new Error(`无效的 dtype：${value ?? ""}`);
            args.dtype = value;
        }
        else if (arg.startsWith("--dtype=")) {
            const value = arg.slice("--dtype=".length);
            if (!is_dtype(value)) throw new Error(`无效的 dtype：${value}`);
            args.dtype = value;
        }
        else if (arg === "--output") {
            args.output = argv[++i] ?? args.output;
        }
        else if (arg.startsWith("--output=")) {
            args.output = arg.slice("--output=".length);
        }
        else if (arg === "--endpoint") {
            args.endpoint = argv[++i] ?? args.endpoint;
        }
        else if (arg.startsWith("--endpoint=")) {
            args.endpoint = arg.slice("--endpoint=".length);
        }
        else if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        }
        else {
            throw new Error(`未知参数：${arg}\n\n${usage()}`);
        }
    }

    args.endpoint = args.endpoint.replace(/\/+$/, "");
    args.output = resolve(args.output);
    return args;
}

async function lock_read(): Promise<ModelLock> {
    const raw = await readFile(LOCK_PATH, "utf8");
    return JSON.parse(raw) as ModelLock;
}

function model_files(lock: ModelLock, dtype: Dtype): string[] {
    const files: string[] = [...RUNTIME_FILES];
    const onnx = dtype === "all"
        ? Object.values(ONNX_FILES)
        : [ONNX_FILES[dtype]];

    for (const file of [...files, ...onnx]) {
        if (!lock.files[file]) throw new Error(`models.lock.json 缺少 ${file}`);
    }
    return [...files, ...onnx];
}

async function hash_file(path: string): Promise<ModelFile> {
    const hash = createHash("sha256");
    let size = 0;

    for await (const chunk of createReadStream(path)) {
        hash.update(chunk);
        size += chunk.length;
    }
    return { size, sha256: hash.digest("hex") };
}

type FileState =
    | { state: "ok"; actual: ModelFile }
    | { state: "missing" }
    | { state: "mismatch"; actual: ModelFile };

async function file_state(path: string, expected: ModelFile): Promise<FileState> {
    try {
        const info = await stat(path);
        if (!info.isFile()) return { state: "missing" };

        const actual = await hash_file(path);
        if (actual.size !== expected.size || actual.sha256 !== expected.sha256) {
            return { state: "mismatch", actual };
        }
        return { state: "ok", actual };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "missing" };
        throw error;
    }
}

function download_response(url: string, redirects = 0): Promise<IncomingMessage> {
    return new Promise((resolve_response, reject) => {
        const target = new URL(url);
        const get = target.protocol === "http:" ? http_get : https_get;

        const req = get(target, {
            headers: { "User-Agent": "memoria-model-fetch" },
        }, (res) => {
            const status = res.statusCode ?? 0;
            const location = res.headers.location;

            if (status >= 300 && status < 400 && location) {
                res.resume();
                if (redirects >= 5) {
                    reject(new Error(`重定向过多：${url}`));
                    return;
                }
                download_response(new URL(location, target).toString(), redirects + 1)
                    .then(resolve_response, reject);
                return;
            }

            if (status !== 200) {
                res.resume();
                reject(new Error(`下载失败（${status}）：${url}`));
                return;
            }
            resolve_response(res);
        });

        req.on("error", reject);
        req.setTimeout(300_000, () => req.destroy(new Error(`下载超时：${url}`)));
    });
}

async function download_file(
    endpoint: string,
    lock: ModelLock,
    file: string,
    dest: string,
    expected: ModelFile,
): Promise<void> {
    const url = `${endpoint}/${lock.model}/resolve/${lock.revision}/${file}`;
    const part = `${dest}.part`;

    await mkdir(dirname(dest), { recursive: true });

    const res = await download_response(url);
    const hash = createHash("sha256");
    let size = 0;

    try {
        await pipeline(
            res,
            new Transform({
                transform(chunk, _encoding, callback) {
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    hash.update(buffer);
                    size += buffer.length;
                    callback(null, buffer);
                },
            }),
            createWriteStream(part),
        );
    } catch (error) {
        await rm(part, { force: true });
        throw error;
    }

    const actual = { size, sha256: hash.digest("hex") };
    if (actual.size !== expected.size || actual.sha256 !== expected.sha256) {
        await rm(part, { force: true });
        throw new Error(
            `文件校验失败：${file}\n` +
            `expected ${expected.size} ${expected.sha256}\n` +
            `actual   ${actual.size} ${actual.sha256}`,
        );
    }

    await rm(dest, { force: true });
    await rename(part, dest);
}

async function main(): Promise<void> {
    const args = args_parse(process.argv.slice(2));
    const lock = await lock_read();
    const root = resolve(args.output, lock.directory);
    const files = model_files(lock, args.dtype);

    console.log(`model  ${lock.model}@${lock.revision.slice(0, 7)}`);
    console.log(`root   ${root}`);
    console.log(`dtype  ${args.dtype}`);
    console.log("");

    if (args.check) {
        let failed = 0;

        for (const file of files) {
            const expected = lock.files[file];
            const dest = join(root, file);
            const state = await file_state(dest, expected);

            if (state.state === "ok") {
                console.log(`  ok       ${file}`);
                continue;
            }

            failed += 1;
            if (state.state === "missing") {
                console.log(`  missing  ${file}`);
            } else {
                console.log(
                    `  mismatch ${file}\n` +
                    `           expected ${expected.size} ${expected.sha256}\n` +
                    `           actual   ${state.actual.size} ${state.actual.sha256}`,
                );
            }
        }

        console.log("");
        if (failed > 0) {
            process.exitCode = 1;
            console.log(`校验失败：${failed} 个文件缺失或哈希不一致。运行 npm run model:fetch 重新拉取。`);
        } else {
            console.log("校验通过。");
        }
        return;
    }

    for (const file of files) {
        const expected = lock.files[file];
        const dest = join(root, file);
        const state = args.force ? { state: "missing" as const } : await file_state(dest, expected);

        if (state.state === "ok") {
            console.log(`  skip     ${file}`);
            continue;
        }

        console.log(`  download ${file}`);
        await download_file(args.endpoint, lock, file, dest, expected);
    }

    console.log("");
    console.log(`完成。模型目录：${root}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("可尝试设置 HF_ENDPOINT 为镜像地址后重试。");
    process.exitCode = 1;
});
