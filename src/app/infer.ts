
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    INFER_MODEL,
    INFER_SETTING_DEFAULT,
    type InferSetting,
    type InferBackend
} from "./settings";

export interface Infer {
    setting: InferSetting;

    encode(texts: string[]): Promise<number[][]>;
}

// Infer

let infer: Infer | null = null;

export async function infer_get(): Promise<Infer> {
    if (!infer) {
        infer = await infer_create();
    }
    return infer;
}

export async function infer_create(): Promise<Infer> {
    const { pipeline } = await import("@huggingface/transformers");

    let error = "";

    async function executor_load(backend: InferBackend): Promise<unknown> {
        return pipeline("feature-extraction", INFER_MODEL, {
            device: backend,
            dtype:  backend === "webgpu" ? "fp16" : "fp32",
        });
    }

    let setting:            InferSetting = { ...INFER_SETTING_DEFAULT };
    let executor:           Awaited<ReturnType<typeof executor_load>> | null = null;
    let executor_loadevent: Promise<void> | null = null;
    
    async function executor_load_try(): Promise<void> {
        if (executor_loadevent) {
            return executor_loadevent;
        }

        executor_loadevent = (async () => {
            
            // WebGPU
            if (navigator.gpu) {
                try {
                    executor = await executor_load("webgpu");
                    setting.backend = "webgpu";
                    setting.ready   = true;
                    return;
                } catch (err) {
                    error = `webgpu: ${String(err)}`;
                }
            }

            // WASM
            try {
                executor = await executor_load("wasm");
                setting.backend = "wasm";
                setting.ready   = true;
                return;
            } catch (err) {
                error = `wasm: ${String(err)}`;
                executor = null;
            }
            
            if (!executor) {
                throw new Error(`模型加载失败：${error || "未知错误"}`);
            }
        })();
        return executor_loadevent;
    }

    const infer: Infer = {
        setting: setting,
        async encode(texts: string[]): Promise<number[][]> {
            await executor_load_try();
            if (!executor) throw new Error("infer not ready");

            const output = (await (executor as never as {
                (texts: string[], options: { pooling: string; normalize: boolean }): Promise<{
                    tolist(): number[][];
                    dims?: number[];
                }>;
            })(texts, { pooling: "mean", normalize: true }));
            const list = output.tolist();
            return list;
        }
    };

    return infer;
}
