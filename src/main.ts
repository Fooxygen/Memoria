
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ResultHit, TextChunk } from "./app/types";
import { SAMPLE_DOCS } from "./app/samples";
import { text_chunk_document } from "./app/text";
import { score_chunk } from "./app/scoring";
import { dropdown_create } from "./app/dropdown";
import { create_embedder, type Embedder } from "./app/embed";
import {
    render_lib_empty,
    render_lib_items,
    render_queue_cards,
    render_result_card,
    render_result_empty,
    render_toast,
    type LibDoc,
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

// DOM

function by_id<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

const drop_zone         = by_id("drop_zone");
const file_input        = by_id<HTMLInputElement>("file_input");
const btn_load_sample   = by_id("btn_load_sample");
const btn_clear_docs    = by_id("btn_clear_docs");
const doc_list          = by_id("doc_list");
const doc_count         = by_id("doc_count");
const page_switch       = by_id("page_switch");
const page_docs         = by_id("page_docs");
const page_queue        = by_id("page_queue");
const queue_shelf       = by_id("queue_shelf");
const search_input      = by_id<HTMLInputElement>("search_input");
const btn_search        = by_id("btn_search");
const search_mode_dd    = by_id("search_mode_dd");
const top_k_input       = by_id<HTMLInputElement>("top_k");
const top_k_dec         = by_id<HTMLButtonElement>("top_k_dec");
const top_k_inc         = by_id<HTMLButtonElement>("top_k_inc");
const results_list      = by_id("results_list");
const initial_state     = by_id("initial_state");
const stat_chunks       = by_id("stat_chunks");
const stat_latency      = by_id("stat_latency");
const rt_model          = by_id("rt_model");
const rt_source         = by_id("rt_source");
const rt_dim            = by_id("rt_dim");
const rt_backend        = by_id("rt_backend");
const rt_backend_badge  = by_id("rt_backend_badge");
const rt_quant          = by_id("rt_quant");

// Process

let documents_ingest:       File[]          = [];
let documents_ingest_busy:  boolean         = false;
let documents_ingest_cards: QueueCardItem[] = [];

// Embedding

let embedder: Embedder | null = null;

// Page

type  PageName = "home" | "ingest";
let   page_active: PageName | null = null;
const page_switchs_content = new Map<PageName, { btn: HTMLButtonElement; label: HTMLElement }>();

const document_opening = new Set<string>();

// Search

let chunks:             TextChunk[] = [];
let search_mode_value:  SearchMode  = SEARCH_DEFAULTS.mode;



// WaterFall

function       mount_waterfall(container: HTMLElement, html: string, empty_html: string): void {
    if (!html.trim()) {
        container.innerHTML = empty_html;
        return;
    }
    const host = document.createElement("div");
    host.innerHTML = html;
    const cards = Array.from(host.children) as HTMLElement[];

    const col_a = document.createElement("div");
    col_a.className = "doc_waterfall_col";
    const col_b = document.createElement("div");
    col_b.className = "doc_waterfall_col";
    container.innerHTML = "";
    container.append(col_a, col_b);

    cards.forEach((card, index) => {
        if (index % 2 === 0) col_a.appendChild(card);
        else col_b.appendChild(card);
    });
}

// HTTP

async function json_post(url: string, payload: unknown): Promise<unknown> {
    const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`request failed ${res.status}`);
    return res.json();
}

// Embedding

async function embedder_get(): Promise<Embedder> {
    if (!embedder) {
        embedder = await create_embedder();
        const info = embedder.info();
        runtime_update({
            ...RUNTIME_INFO,
            source: "HuggingFace · Transformers.js",
            dimension: info.dimension,
            backend: info.backend,
            ready: true,
        });
    }
    return embedder;
}

// Process

async function document_process(file: File): Promise<void> {

    const doc = {
        id:      `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title:   file.name.replace(/\.[^.]+$/, ""),
        content: await file.text()
    };

    // Chunks
    const chunks = text_chunk_document(doc);

    // Embedding
    const embedder = await embedder_get();
    const vecs     = await embedder.encode(chunks.map((c) => c.content));
    
    // Records: Chunks + Embedding + Metadata
    const records  = chunks.map((c, i) => ({
        id: `${doc.id}_chunk${i}`,
        content: c.content,
        embedding: vecs[i],
        meta: { id_document: doc.id, idx_chunk: i },
    }));
    const preview = doc.content.trim().replace(/\s+/g, " ").slice(0, 120);

    await json_post("/api/ingest", {
        doc: {
            id:          doc.id,
            title:       doc.title,
            preview:     preview,
            chunk_count: records.length
        },
        chunks: records,
    });
    render_toast(`已入库：【${doc.title}】· ${records.length} 切片`);
}

async function documents_fetch(): Promise<LibDoc[]> {
    const res = await fetch("/api/documents");
    if (!res.ok) throw new Error(`request failed ${res.status}`);
    const data = (await res.json()) as { documents: LibDoc[] };
    return data.documents ?? [];
}

async function documents_refresh(): Promise<void> {
    let docs: LibDoc[] = [];
    try {
        docs = await documents_fetch();
    } catch (error) {
        render_toast(`无法加载知识库：${String(error)}`);
    }

    doc_count.textContent = String(docs.length);
    stat_chunks.textContent = `切分切片: ${docs.reduce((sum, d) => sum + d.chunk_count, 0)}`;

    mount_waterfall(doc_list, docs.length === 0 ? "" : render_lib_items(docs), render_lib_empty());
    btn_clear_docs.hidden = docs.length === 0;
    refresh_icons();
}

async function documents_ingest_loop(): Promise<void> {
    while (documents_ingest.length > 0) {
        const file = documents_ingest.shift();
        if (!file) break;
        try {
            await document_process(file);
        } catch (error) {
            render_toast(`处理失败：${String(error)}`);
        }
    }
    documents_ingest_busy = false;
    await documents_refresh();
}

function       documents_ingest_insert(data: File[] | FileList | null): void {
    let files: File[] = [];

    if      (data == null) {
        files = [];
    }
    else if (Array.isArray(data)) {
        files = data;
    }
    else {
        files = Array.from(data);
    }

    documents_ingest.push(...files);
    if (!documents_ingest_busy) {
        documents_ingest_busy = true;
        void documents_ingest_loop();
    }
}

function show_initial_state(): void {
    results_list.replaceChildren(initial_state);
}

// Runtime

function runtime_update(info: RuntimeInfo = RUNTIME_INFO): void {
    rt_model.textContent  = info.model_name;
    rt_source.textContent = info.source;
    rt_dim.textContent    = `${info.dimension} 维`;
    rt_quant.textContent  = info.quant;

    const backend_label = info.backend === "webgpu" ? "WebGPU" : "WASM";
    rt_backend.textContent = backend_label;
    rt_backend_badge.classList.toggle("is_webgpu", info.backend === "webgpu");
    rt_backend_badge.classList.toggle("is_wasm", info.backend === "wasm");
}

// Search

function search_init(): void {
    dropdown_create<SearchMode>(search_mode_dd, SEARCH_MODES, SEARCH_DEFAULTS.mode, (value) => {
        search_mode_value = value;
    });
    top_k_input.min = String(SEARCH_DEFAULTS.top_k_min);
    top_k_input.max = String(SEARCH_DEFAULTS.top_k_max);
    top_k_input.value = String(SEARCH_DEFAULTS.top_k);
}

function search_execute(): void {
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

function search_topk_read(): number {
    return Math.min(
        SEARCH_DEFAULTS.top_k_max,
        Math.max(SEARCH_DEFAULTS.top_k_min, parseInt(top_k_input.value, 10) || SEARCH_DEFAULTS.top_k),
    );
}

function search_topk_modifier_update(): void {
    const value = search_topk_read();
    top_k_dec.disabled = value <= SEARCH_DEFAULTS.top_k_min;
    top_k_inc.disabled = value >= SEARCH_DEFAULTS.top_k_max;
}

function search_topk_update(value: number): void {
    top_k_input.value = String(value);
    search_topk_modifier_update();
}

// Page

function page_active_set(page: PageName, active: boolean): void {
    const entry = page_switchs_content.get(page);
    if (!entry) return;
    if (active) {
        const icon_w = entry.btn.querySelector<HTMLElement>(".switch_icon")?.offsetWidth ?? 32;
        const label_w = entry.label.scrollWidth;
        entry.btn.classList.add("is_active");
        entry.btn.style.width = `${icon_w + label_w + 18}px`;
        entry.btn.dataset.spin = page === "ingest" ? "true" : "false";
    } else {
        entry.btn.classList.remove("is_active");
        entry.btn.style.removeProperty("width");
        delete entry.btn.dataset.spin;
    }
}

function page_active_show(page: PageName): void {
    if (page_active === page) return;
    page_active = page;
    page_docs.hidden = page !== "home";
    page_queue.hidden = page !== "ingest";
    page_active_set("home", page === "home");
    page_active_set("ingest", page === "ingest");
}

function page_switch_button_create(page: PageName, icon: string, label_text: string): HTMLButtonElement {
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
    btn.addEventListener("click", () => page_active_show(page));
    page_switchs_content.set(page, { btn, label: label_el });
    return btn;
}

function page_switchs_button_create(): void {
    page_switch.appendChild(page_switch_button_create("home", "upload-cloud", "上传文档"));
    page_switch.appendChild(page_switch_button_create("ingest", "loader-circle", "处理队列"));
    page_active_show("home");
}

function page_ingest_cards_render(): void {
    mount_waterfall(
        queue_shelf,
        documents_ingest_cards.length ? render_queue_cards(documents_ingest_cards) : "",
        '<p class="doc_shelf_empty">处理队列为空</p>',
    );
}

function page_ingest_cards_status_render(): void {
    for (const list of [doc_list, queue_shelf]) {
        list.querySelectorAll<HTMLElement>(".doc_card").forEach((card) => {
            const key = card.dataset.key ?? "";
            card.classList.toggle("is_open", document_opening.has(key));
        });
    }
}

function page_ingest_cards_status_sync(title: string): void {
    const opening = !document_opening.has(title);
    document_opening.clear();
    if (opening) document_opening.add(title);
    page_ingest_cards_status_render();
}

// Event Listener

drop_zone.addEventListener("click", () => file_input.click());

drop_zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop_zone.classList.add("is_dragover");
});

drop_zone.addEventListener("dragleave", () => drop_zone.classList.remove("is_dragover"));

drop_zone.addEventListener("drop", (event) => {
    event.preventDefault();
    drop_zone.classList.remove("is_dragover");
    documents_ingest_insert(event.dataTransfer?.files ?? null);
});

file_input.addEventListener("change", (event) => {
    documents_ingest_insert((event.target as HTMLInputElement).files);
});

btn_load_sample.addEventListener("click", () => {
    const files = SAMPLE_DOCS.map((d) => new File([d.content], d.title, { type: "text/plain" }));
    documents_ingest_insert(files);
    render_toast("正在导入演示文档库…");
});

btn_clear_docs.addEventListener("click", () => {
    documents_ingest = [];
    document_opening.clear();
    void documents_refresh();
    show_initial_state();
    render_toast("已重置界面（数据库持久保留，重新上传即可更新）");
});

btn_search.addEventListener("click", search_execute);

top_k_dec.addEventListener("click", () => search_topk_update(search_topk_read() - 1));
top_k_inc.addEventListener("click", () => search_topk_update(search_topk_read() + 1));
top_k_input.addEventListener("input", search_topk_modifier_update);
top_k_input.addEventListener("change", () => search_topk_update(search_topk_read()));

search_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") search_execute();
});

doc_list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>(".doc_card_action");
    const card = target.closest<HTMLElement>(".doc_card");
    if (!card) return;
    const key = card.dataset.key;
    if (!key) return;
    if (action) {
        documents_ingest_cards = documents_ingest_cards.filter((it) => it.title !== key);
        page_ingest_cards_render();
        page_ingest_cards_status_render();
        refresh_icons();
        return;
    }
    page_ingest_cards_status_sync(key);
});

queue_shelf.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>(".doc_card_action");
    const card = target.closest<HTMLElement>(".doc_card");
    if (!card) return;
    const key = card.dataset.key;
    if (!key) return;
    if (action) {
        documents_ingest_cards = documents_ingest_cards.filter((it) => it.title !== key);
        page_ingest_cards_render();
        page_ingest_cards_status_render();
        refresh_icons();
        return;
    }
    page_ingest_cards_status_sync(key);
});

page_switchs_button_create();
page_ingest_cards_render();
refresh_icons();
runtime_update({
    ...RUNTIME_INFO,
    backend: navigator.gpu ? "webgpu" : "wasm",
});
search_init();
search_topk_modifier_update();
show_initial_state();
void documents_refresh();
