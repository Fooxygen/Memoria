
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ResultHit, SourceDoc, TextChunk } from "./app/types";
import { SAMPLE_DOCS } from "./app/samples";
import { text_chunk_document } from "./app/text";
import { score_chunk, type SearchMode } from "./app/scoring";
import {
    render_lib_empty,
    render_lib_items,
    render_result_card,
    render_result_empty,
    render_toast,
} from "./app/render";
import { refresh_icons } from "./app/icons";

function by_id<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

const drop_zone = by_id("drop_zone");
const file_input = by_id<HTMLInputElement>("file_input");
const btn_load_sample = by_id("btn_load_sample");
const btn_clear_docs = by_id("btn_clear_docs");
const doc_list = by_id("doc_list");
const doc_count = by_id("doc_count");
const search_input = by_id<HTMLInputElement>("search_input");
const btn_search = by_id("btn_search");
const search_mode = by_id<HTMLSelectElement>("search_mode");
const top_k_input = by_id<HTMLInputElement>("top_k");
const results_list = by_id("results_list");
const initial_state = by_id("initial_state");
const stat_chunks = by_id("stat_chunks");
const stat_latency = by_id("stat_latency");

let documents: SourceDoc[] = [];
let chunks: TextChunk[] = [];

function process_documents(): void {
    chunks = documents.flatMap((doc) => text_chunk_document(doc));

    doc_count.textContent = String(documents.length);
    stat_chunks.textContent = `切分切片: ${chunks.length}`;

    doc_list.innerHTML = documents.length === 0 ? render_lib_empty() : render_lib_items(documents, chunks);
    btn_clear_docs.hidden = documents.length === 0;
    refresh_icons();
}

function show_initial_state(): void {
    results_list.replaceChildren(initial_state);
}

function execute_search(): void {
    const query = search_input.value.trim();
    if (!query) return;

    if (chunks.length === 0) {
        render_toast("知识库中暂无文档切片，请先上传或加载示例文档！");
        return;
    }

    const start = performance.now();
    const mode = search_mode.value as SearchMode;
    const top_k = Math.min(Math.max(parseInt(top_k_input.value, 10) || 4, 1), 20);

    const hits: ResultHit[] = chunks
        .map((chunk) => ({ ...chunk, score: score_chunk(chunk.content, query, mode) }))
        .filter((hit) => hit.score > 0.05)
        .sort((a, b) => b.score - a.score)
        .slice(0, top_k);

    stat_latency.textContent = `匹配响应: ${Math.round(performance.now() - start)} ms`;

    results_list.innerHTML =
        hits.length === 0 ? render_result_empty() : hits.map((hit, i) => render_result_card(hit, i, query)).join("");
    refresh_icons();
}

function handle_files(file_list: FileList | null): void {
    if (!file_list || file_list.length === 0) return;

    Array.from(file_list).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = typeof event.target?.result === "string" ? event.target.result : "";
            documents.push({
                id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: file.name,
                content,
            });
            process_documents();
            render_toast(`已成功将【${file.name}】解析切片存入本地知识库`);
        };
        reader.readAsText(file);
    });
}

drop_zone.addEventListener("click", () => file_input.click());

drop_zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop_zone.classList.add("is_dragover");
});

drop_zone.addEventListener("dragleave", () => drop_zone.classList.remove("is_dragover"));

drop_zone.addEventListener("drop", (event) => {
    event.preventDefault();
    drop_zone.classList.remove("is_dragover");
    handle_files(event.dataTransfer?.files ?? null);
});

file_input.addEventListener("change", (event) => {
    handle_files((event.target as HTMLInputElement).files);
});

btn_load_sample.addEventListener("click", () => {
    documents = [...SAMPLE_DOCS];
    process_documents();
    render_toast("已加载演示知识库，共导入 3 份规范文档！");
});

btn_clear_docs.addEventListener("click", () => {
    documents = [];
    chunks = [];
    process_documents();
    show_initial_state();
    render_toast("知识库已清空");
});

btn_search.addEventListener("click", execute_search);

search_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") execute_search();
});

refresh_icons();
documents = [...SAMPLE_DOCS];
process_documents();
show_initial_state();
