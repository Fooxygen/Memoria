
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    INFER_MODEL,
    INFER_SETTING_DEFAULT,
    type InferSetting,
    type InferBackend
} from "../store/settings";

export const INFER_MODEL_ONNX_URL = `/models/${INFER_MODEL}/onnx/model_quantized.onnx`;

export async function infer_local_available(): Promise<boolean> {
    try {
        const res = await fetch(INFER_MODEL_ONNX_URL, { method: "HEAD" });
        return res.ok;
    } catch {
        return false;
    }
}

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

async function infer_create(): Promise<Infer> {
    const { pipeline, env } = await import("@huggingface/transformers");

    env.localModelPath   = "/models/";
    env.allowLocalModels = true;
    env.allowRemoteModels = false;

    const wasm = env.backends.onnx.wasm;
    if (!wasm) throw new Error("ONNX Runtime WASM 配置不可用");
    wasm.wasmPaths = "/onnx_runtime/";

    const setting: InferSetting = { ...INFER_SETTING_DEFAULT };

    let executor:           Awaited<ReturnType<typeof executor_load>> | null = null;
    let executor_loadevent: Promise<void> | null = null;

    async function executor_load(backend: InferBackend): Promise<unknown> {
        return pipeline("feature-extraction", INFER_MODEL, {
            device: backend,
            dtype:  "q8",
        });
    }

    async function executor_load_try(): Promise<void> {
        if (executor) return;

        if (!executor_loadevent) {
            setting.status = "loading";
            setting.ready   = false;

            executor_loadevent = (async () => {
                const has_webgpu = Boolean(navigator.gpu);
                let webgpu_error = "";

                if (has_webgpu) {
                    try {
                        executor = await executor_load("webgpu");
                        setting.backend = "webgpu";
                        setting.ready   = true;
                        setting.status  = "ready";
                        setting.notice  = "";
                        return;
                    } catch (error) {
                        webgpu_error = String(error);
                    }
                }

                try {
                    executor = await executor_load("wasm");
                    setting.backend = "wasm";
                    setting.ready   = true;
                    setting.status  = "ready";
                    setting.notice  = has_webgpu
                        ? "WebGPU 初始化失败，已自动降级到 WASM"
                        : "当前环境不支持 WebGPU，已使用 WASM";
                    return;
                } catch (error) {
                    executor = null;
                    setting.ready  = false;
                    setting.status = "error";
                    setting.notice = "";

                    const detail = webgpu_error
                        ? `webgpu: ${webgpu_error}; wasm: ${String(error)}`
                        : `wasm: ${String(error)}`;
                    throw new Error(`模型加载失败：${detail}`);
                }
            })();
        }

        try {
            await executor_loadevent;
        } catch (error) {
            executor_loadevent = null;
            executor = null;
            setting.ready  = false;
            setting.status = "error";
            throw error;
        }
    }

    const infer: Infer = {
        setting,
        async encode(texts: string[]): Promise<number[][]> {
            await executor_load_try();
            if (!executor) throw new Error("infer not ready");

            const output = (await (executor as never as {
                (texts: string[], options: { pooling: string; normalize: boolean }): Promise<{
                    tolist(): number[][];
                    dims?: number[];
                }>;
            })(texts, { pooling: "mean", normalize: true }));
            return output.tolist();
        }
    };

    return infer;
}
