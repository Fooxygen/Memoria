
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { Backend } from "./settings";

export const EMBEDDING_MODEL = "onnx-community/all-MiniLM-L6-v2-ONNX";
export const EMBEDDING_DIM = 384;

export interface EmbedderInfo {
    backend: Backend;
    dimension: number;
    ready: boolean;
}

export interface Embedder {
    encode(texts: string[]): Promise<number[][]>;
    info(): EmbedderInfo;
}

type Device = "webgpu" | "wasm";

export async function create_embedder(): Promise<Embedder> {
    const { pipeline } = await import("@huggingface/transformers");

    let backend: Backend = "wasm";
    let last_error = "";

    async function load(device: Device): Promise<unknown> {
        return pipeline("feature-extraction", EMBEDDING_MODEL, {
            device,
            dtype: device === "webgpu" ? "fp16" : "fp32",
        });
    }

    let extractor: Awaited<ReturnType<typeof load>> | null = null;
    let load_promise: Promise<void> | null = null;
    let dimension = EMBEDDING_DIM;

    async function ensure_loaded(): Promise<void> {
        if (load_promise) return load_promise;
        load_promise = (async () => {
            if (navigator.gpu) {
                try {
                    extractor = await load("webgpu");
                    backend = "webgpu";
                    return;
                } catch (error) {
                    last_error = `webgpu: ${String(error)}`;
                }
            }
            try {
                extractor = await load("wasm");
                backend = "wasm";
            } catch (error) {
                last_error = `wasm: ${String(error)}`;
                extractor = null;
            }
            if (!extractor) {
                throw new Error(`模型加载失败：${last_error || "未知错误"}`);
            }
        })();
        return load_promise;
    }

    const embedder: Embedder = {
        async encode(texts: string[]): Promise<number[][]> {
            await ensure_loaded();
            if (!extractor) throw new Error("embedder not ready");
            const output = (await (extractor as never as {
                (texts: string[], options: { pooling: string; normalize: boolean }): Promise<{
                    tolist(): number[][];
                    dims?: number[];
                }>;
            })(texts, { pooling: "mean", normalize: true }));
            const list = output.tolist();
            if (list.length > 0 && Array.isArray(list[0]) && list[0].length !== dimension) {
                dimension = list[0].length;
            }
            return list;
        },
        info() {
            return { backend, dimension, ready: !!extractor };
        },
    };

    await ensure_loaded();
    return embedder;
}
