
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

export type SearchMode = "hybrid" | "semantic" | "keyword";
export type QuantMode = "int8" | "fp16";
export type Backend = "webgpu" | "wasm";

export interface RuntimeInfo {
    model_name: string;
    source: string;
    dimension: number;
    quant: QuantMode;
    backend: Backend;
    ready: boolean;
}

export const RUNTIME_INFO: RuntimeInfo = {
    model_name: "all-MiniLM-L6-v2",
    source: "Xenova · HuggingFace",
    dimension: 384,
    quant: "int8",
    backend: "wasm",
    ready: false,
};

export interface SearchModeOption {
    value: SearchMode;
    label: string;
}

export const SEARCH_MODES: SearchModeOption[] = [
    { value: "hybrid", label: "混合检索 (Vector + BM25)" },
    { value: "semantic", label: "纯语义向量 (Semantic)" },
    { value: "keyword", label: "精确关键词 (BM25)" },
];

export const SEARCH_DEFAULTS = {
    mode: "hybrid" as SearchMode,
    top_k: 4,
    top_k_min: 1,
    top_k_max: 20,
};
