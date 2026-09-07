
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

// Infer

export const INFER_MODEL      = "Xenova/all-MiniLM-L6-v2";
export const INFER_MODEL_NAME = "all-MiniLM-L6-v2";
export const INFER_MODEL_SRC  = "Xenova · HuggingFace";
export const INFER_MODEL_DIM  = 384;
export type  InferQuant       = "int8"   | "fp16";
export type  InferBackend     = "webgpu" | "wasm";

export interface InferSetting {
    quant:   InferQuant;
    backend: InferBackend;
    ready:   boolean;
}

export const INFER_SETTING_DEFAULT: InferSetting = {
    quant:   "int8",
    backend: "webgpu",
    ready:   false
};

// Search

export type SearchMode = "hybrid" | "semantic";

export interface SearchModeOption {
    value: SearchMode;
    label: string;
}

export const SEARCH_MODE_OPTIONS: SearchModeOption[] = [
    { value: "hybrid",   label: "混合检索" },
    { value: "semantic", label: "向量检索" },
];

export interface SearchSetting {
    mode:      SearchMode;
    top_k:     number;
    top_k_min: number;
    top_k_max: number;
}

export const SEARCH_SETTING_DEFAULT: SearchSetting = {
	mode:      "hybrid",
	top_k:     12,
	top_k_min: 1,
	top_k_max: 48,
};
