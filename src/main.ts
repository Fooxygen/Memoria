
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ResultHit, SourceDoc, TextChunk } from "./app/types";
import { SAMPLE_DOCS } from "./app/samples";
import { text_chunk_document } from "./app/text";
import { score_chunk } from "./app/scoring";
import { dropdown_create } from "./app/dropdown";
import {
    render_lib_empty,
    render_lib_items,
    render_queue_cards,
    render_result_card,
    render_result_empty,
    render_toast,
    type QueueCardItem,
} from "./app/render";
import { refresh_icons } from "./app/icons";
import {
    RUNTIME_INFO,
    SEARCH_DEFAULTS,
    SEARCH_MODES,
    type RuntimeInfo,
    type SearchMode,
} from "./app/settings";

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
const page_switch = by_id("page_switch");
const page_docs = by_id("page_docs");
const page_queue = by_id("page_queue");
const queue_shelf = by_id("queue_shelf");
const search_input = by_id<HTMLInputElement>("search_input");
const btn_search = by_id("btn_search");
const search_mode_dd = by_id("search_mode_dd");
const top_k_input = by_id<HTMLInputElement>("top_k");
const top_k_dec = by_id<HTMLButtonElement>("top_k_dec");
const top_k_inc = by_id<HTMLButtonElement>("top_k_inc");
const results_list = by_id("results_list");
const initial_state = by_id("initial_state");
const stat_chunks = by_id("stat_chunks");
const stat_latency = by_id("stat_latency");
const rt_model = by_id("rt_model");
const rt_source = by_id("rt_source");
const rt_dim = by_id("rt_dim");
const rt_backend = by_id("rt_backend");
const rt_backend_badge = by_id("rt_backend_badge");
const rt_quant = by_id("rt_quant");

let documents: SourceDoc[] = [];
let chunks: TextChunk[] = [];
let search_mode_value: SearchMode = SEARCH_DEFAULTS.mode;
const opened_docs = new Set<string>();

function mount_docs_waterfall(html: string, empty_html: string): void {
    if (!html.trim()) {
        doc_list.innerHTML = empty_html;
        return;
    }
    const host = document.createElement("div");
    host.innerHTML = html;
    const cards = Array.from(host.children) as HTMLElement[];

    const col_a = document.createElement("div");
    col_a.className = "doc_waterfall_col";
    const col_b = document.createElement("div");
    col_b.className = "doc_waterfall_col";
    doc_list.innerHTML = "";
    doc_list.append(col_a, col_b);

    cards.forEach((card, index) => {
        if (index % 2 === 0) col_a.appendChild(card);
        else col_b.appendChild(card);
    });
}

function process_documents(): void {
    chunks = documents.flatMap((doc) => text_chunk_document(doc));

    doc_count.textContent = String(documents.length);
    stat_chunks.textContent = `切分切片: ${chunks.length}`;

    mount_docs_waterfall(
        documents.length === 0 ? "" : render_lib_items(documents, chunks),
        render_lib_empty(),
    );
    btn_clear_docs.hidden = documents.length === 0;
    refresh_icons();
}

function show_initial_state(): void {
    results_list.replaceChildren(initial_state);
}

function update_runtime(info: RuntimeInfo = RUNTIME_INFO): void {
    rt_model.textContent = info.model_name;
    rt_source.textContent = info.source;
    rt_dim.textContent = `${info.dimension} 维`;
    rt_quant.textContent = info.quant;

    const backend_label = info.backend === "webgpu" ? "WebGPU" : "WASM";
    rt_backend.textContent = backend_label;
    rt_backend_badge.classList.toggle("is_webgpu", info.backend === "webgpu");
    rt_backend_badge.classList.toggle("is_wasm", info.backend === "wasm");
}

function fill_search_settings(): void {
    dropdown_create<SearchMode>(search_mode_dd, SEARCH_MODES, SEARCH_DEFAULTS.mode, (value) => {
        search_mode_value = value;
    });
    top_k_input.min = String(SEARCH_DEFAULTS.top_k_min);
    top_k_input.max = String(SEARCH_DEFAULTS.top_k_max);
    top_k_input.value = String(SEARCH_DEFAULTS.top_k);
}

function execute_search(): void {
    const query = search_input.value.trim();
    if (!query) return;

    if (chunks.length === 0) {
        render_toast("知识库中暂无文档切片，请先上传或加载示例文档！");
        return;
    }

    const start = performance.now();
    const mode = search_mode_value;
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

function read_top_k(): number {
    return Math.min(
        SEARCH_DEFAULTS.top_k_max,
        Math.max(SEARCH_DEFAULTS.top_k_min, parseInt(top_k_input.value, 10) || SEARCH_DEFAULTS.top_k),
    );
}

function sync_step_state(): void {
    const value = read_top_k();
    top_k_dec.disabled = value <= SEARCH_DEFAULTS.top_k_min;
    top_k_inc.disabled = value >= SEARCH_DEFAULTS.top_k_max;
}

function apply_top_k(value: number): void {
    top_k_input.value = String(value);
    sync_step_state();
}

top_k_dec.addEventListener("click", () => apply_top_k(read_top_k() - 1));
top_k_inc.addEventListener("click", () => apply_top_k(read_top_k() + 1));
top_k_input.addEventListener("input", sync_step_state);
top_k_input.addEventListener("change", () => apply_top_k(read_top_k()));

search_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") execute_search();
});

type PageName = "docs" | "queue";

let queue_items: QueueCardItem[] = [
    { title: "入职手册 v3", status: "run" },
    { title: "RAG 架构笔记", status: "wait" },
    { title: "数据安全规范", status: "done" },
    { title: "产品说明书 2026", status: "wait" },
];

const switch_entries = new Map<PageName, { btn: HTMLButtonElement; label: HTMLElement }>();

function make_switch_button(page: PageName, icon: string, label_text: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "switch_btn";
    btn.dataset.page = page;
    btn.title = label_text;

    const icon_el = document.createElement("span");
    icon_el.className = "switch_icon";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", icon);
    icon_el.appendChild(i);

    const label_el = document.createElement("span");
    label_el.className = "switch_label";
    label_el.textContent = label_text;

    btn.append(icon_el, label_el);
    btn.addEventListener("click", () => show_page(page));
    switch_entries.set(page, { btn, label: label_el });
    return btn;
}

function set_tab_active(page: PageName, active: boolean): void {
    const entry = switch_entries.get(page);
    if (!entry) return;
    if (active) {
        const icon_w = entry.btn.querySelector<HTMLElement>(".switch_icon")?.offsetWidth ?? 32;
        const label_w = entry.label.scrollWidth;
        entry.btn.classList.add("is_active");
        entry.btn.style.width = `${icon_w + label_w + 18}px`;
        entry.btn.dataset.spin = page === "queue" ? "true" : "false";
    } else {
        entry.btn.classList.remove("is_active");
        entry.btn.style.removeProperty("width");
        delete entry.btn.dataset.spin;
    }
}

let active_page: PageName | null = null;

function show_page(page: PageName): void {
    if (active_page === page) return;
    active_page = page;
    page_docs.hidden = page !== "docs";
    page_queue.hidden = page !== "queue";
    set_tab_active("docs", page === "docs");
    set_tab_active("queue", page === "queue");
}

function build_page_switch(): void {
    page_switch.appendChild(make_switch_button("docs", "upload-cloud", "上传文档"));
    page_switch.appendChild(make_switch_button("queue", "loader-circle", "处理队列"));
    show_page("docs");
}

function fill_queue(): void {
    queue_shelf.innerHTML = render_queue_cards(queue_items);
}

function sync_open_cards(): void {
    for (const list of [doc_list, queue_shelf]) {
        list.querySelectorAll<HTMLElement>(".doc_card").forEach((card) => {
            const key = card.dataset.key ?? "";
            card.classList.toggle("is_open", opened_docs.has(key));
        });
    }
}

function toggle_doc_open(title: string): void {
    const opening = !opened_docs.has(title);
    opened_docs.clear();
    if (opening) opened_docs.add(title);
    sync_open_cards();
}

function bind_open(list: HTMLElement): void {
    list.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const action = target.closest<HTMLElement>(".doc_card_action");
        const card = target.closest<HTMLElement>(".doc_card");
        if (!card) return;
        const key = card.dataset.key;
        if (!key) return;
        if (action) {
            queue_items = queue_items.filter((it) => it.title !== key);
            fill_queue();
            sync_open_cards();
            refresh_icons();
            return;
        }
        toggle_doc_open(key);
    });
}

build_page_switch();
fill_queue();
bind_open(doc_list);
bind_open(queue_shelf);
refresh_icons();
update_runtime();
fill_search_settings();
sync_step_state();
documents = [...SAMPLE_DOCS];
process_documents();
show_initial_state();
