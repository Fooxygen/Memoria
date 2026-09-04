
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

export type SearchMode = "hybrid" | "semantic" | "keyword";
export type QuantMode  = "int8"   | "fp16";
export type Backend    = "webgpu" | "wasm";

// Runtime

export interface RuntimeInfo {
    model_name: string;
    source:     string;
    dimension:  number;
    quant:      QuantMode;
    backend:    Backend;
    ready:      boolean;
}

export const RUNTIME_INFO: RuntimeInfo = {
    model_name: "all-MiniLM-L6-v2",
    source:     "Xenova · HuggingFace",
    dimension:  384,
    quant:      "int8",
    backend:    "webgpu",
    ready:      false,
};

// Search

export interface SearchModeOption {
    value: SearchMode;
    label: string;
}

export const SEARCH_MODES: SearchModeOption[] = [
    { value: "hybrid",   label: "混合检索" },
    { value: "semantic", label: "向量检索" },
    { value: "keyword",  label: "全文检索" },
];

export interface SearchDefaults {
    mode:      SearchMode;
    top_k:     number;
    top_k_min: number;
    top_k_max: number;
}

export const SEARCH_DEFAULTS: SearchDefaults = {
    mode: "hybrid",
    top_k: 4,
    top_k_min: 1,
    top_k_max: 20,
};
