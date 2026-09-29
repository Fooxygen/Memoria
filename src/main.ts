
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { text_chunk_document } from "./store/text";
import { infer_get, infer_local_available } from "./infer";
import {
    render_lib_empty,
    render_lib_items,
    render_queue_cards,
    render_result_collection,
    render_reader_document,
    type LibDoc,
    type QueueCardItem,
    type SearchHit,
} from "./ui/render";
import { refresh_icons }        from "./ui/icons";
import {
    INFER_SETTING_DEFAULT,
    SEARCH_SETTING_DEFAULT,
    SEARCH_MODE_OPTIONS,
    type InferSetting,
    type SearchMode,
    INFER_MODEL_NAME,
    INFER_MODEL_SRC,
    INFER_MODEL_DIM,
} from "./store/settings";

// DOM

function by_id<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

const drop_zone         = by_id("drop_zone");
const file_input        = by_id<HTMLInputElement>("file_input");
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
const card_menu         = by_id("card_menu");
const card_menu_delete  = by_id("card_menu_delete");
const logs_box          = by_id("logs");
const logs_trigger      = by_id("logs_trigger");
const logs_panel        = by_id("logs_panel");
const logs_list         = by_id("logs_list");
const searchdock        = by_id("searchdock");
const rt_model          = by_id("rt_model");
const rt_download       = by_id("rt_download");
const rt_loader         = by_id("rt_loader");
const rt_source         = by_id("rt_source");
const rt_dim            = by_id("rt_dim");
const rt_backend        = by_id("rt_backend");
const rt_backend_badge  = by_id("rt_backend_badge");
const rt_quant          = by_id("rt_quant");
const app               = by_id("app");
const sidebar_toggle    = by_id("sidebar_toggle");
const reader_close      = by_id("reader_close");
const page_group        = by_id("page_group");
const page_reader       = by_id("page_reader");
const page_reader_body  = by_id("page_reader_body");
const page_reader_title = page_reader.querySelector<HTMLElement>(".page_reader_title");

// Layout

let sidebar_collapsed = false;
let reader_doc_id: string | null = null;

function sidebar_collapsed_set(value: boolean): void {
    sidebar_collapsed = value;
    app.classList.toggle("is_sidebar_collapsed", value);
}

function reader_visible_set(value: boolean): void {
    page_group.classList.toggle("is_split", value);
    page_reader.hidden = !value;
    document_opening.clear();
    if (value && reader_doc_id) {
        document_opening.add(reader_doc_id);
    }
    page_ingest_cards_status_render();
}

async function reader_open(id: string, title: string): Promise<void> {
    reader_doc_id = id;
    reader_visible_set(true);
    if (page_reader_title) page_reader_title.textContent = title;
    page_reader_body.innerHTML = `<p class="reader_hint">加载中…</p>`;
    try {
        const res = await fetch(`/api/document/content?id=${encodeURIComponent(id)}`);
        if (res.status === 404) {
            page_reader_body.innerHTML = `<p class="reader_hint">该文档没有保存原文，请重新导入。</p>`;
            return;
        }
        if (!res.ok) throw await json_error(res);
        const data = (await res.json()) as { content?: string };
        page_reader_body.innerHTML = render_reader_document(data.content ?? "");
    } catch (error) {
        page_reader_body.innerHTML = `<p class="reader_hint">原文加载失败</p>`;
        log_push("原文加载失败", String(error));
    }
}

// Process

let documents_ingest:       File[]          = [];
let documents_ingest_busy:  boolean         = false;
let documents_ingest_cards: QueueCardItem[] = [];
let ingest_task_id:         number          = 0;

// Page

type  PageName = "home" | "ingest";
let   page_active: PageName | null = null;
const page_switchs_content = new Map<PageName, { btn: HTMLButtonElement; label: HTMLElement }>();

const document_opening = new Set<string>();

// Search

let search_mode_value:  SearchMode  = SEARCH_SETTING_DEFAULT.mode;
let searchdock_docked:  boolean     = false;

// Logs

type LogState = "collapsed" | "peek" | "expanded";

interface LogEntry {
    id:      number;
    message: string;
    detail:  string;
    time:    number;
}

const LOG_PAGE = 10;

let logs:          LogEntry[]     = [];
let log_next_id:   number         = 0;
let logs_state:    LogState       = "collapsed";
let logs_visible:  number         = LOG_PAGE;



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
        card.style.animationDelay = `${(0.5 + index * 0.06).toFixed(2)}s`;
        if (index % 2 === 0) col_a.appendChild(card);
        else col_b.appendChild(card);
    });
}

// HTTP

async function json_error(res: Response): Promise<Error> {
    let detail = "";
    try {
        const data = (await res.json()) as { error?: string };
        detail = data.error ?? "";
    } catch {}
    return new Error(detail ? `${res.status}: ${detail}` : `request failed ${res.status}`);
}

async function json_post(url: string, payload: unknown): Promise<unknown> {
    const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    if (!res.ok) throw await json_error(res);
    return res.json();
}

async function json_delete(url: string): Promise<unknown> {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw await json_error(res);
    return res.json();
}

// Infer

function infer_ui_sync(setting: InferSetting = INFER_SETTING_DEFAULT): void {

    // Fixed
    rt_model.textContent  = INFER_MODEL_NAME;
    rt_source.textContent = INFER_MODEL_SRC;
    rt_dim.textContent    = `${INFER_MODEL_DIM} 维`;

    // Quant
    rt_quant.textContent = setting.quant;

    // Backend
    const backend = setting.backend === "webgpu" ? "WebGPU" : "WASM";
    rt_backend.textContent = backend;
    rt_backend_badge.classList.toggle("is_webgpu", setting.backend === "webgpu");
    rt_backend_badge.classList.toggle("is_wasm", setting.backend === "wasm");
}

function infer_phase_set(mode: "load" | "download" | null): void {
    rt_download.hidden = mode !== "download";
    rt_loader.hidden   = mode !== "load";
}

// Logs

function log_time_ago(ts: number): string {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return `${min} 分钟前`;
    const hr = Math.floor(min / 60);
    return `${hr} 小时前`;
}

function log_escape(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function log_render_item(entry: LogEntry, open: boolean): string {
    const detail = entry.detail ? `<p class="log_item_detail">${log_escape(entry.detail)}</p>` : "";
    return `
        <li class="log_item${open ? " is_open" : ""}" data-id="${entry.id}">
            <p class="log_item_msg">${log_escape(entry.message)}</p>
            <span class="log_item_time">${log_time_ago(entry.time)}</span>
            ${detail}
        </li>`;
}

function log_state_set(state: LogState): void {
    logs_state = state;
    logs_visible = LOG_PAGE;
    logs_box.classList.toggle("is_open", state !== "collapsed");
    logs_render();
}

function logs_render(): void {
    if (logs.length === 0) {
        logs_list.innerHTML = `<li class="logs_empty">日志队列为空</li>`;
        return;
    }
    const items = logs_state === "expanded" ? logs : logs.slice(0, 1);
    const limited = items.slice(0, logs_visible);
    logs_list.innerHTML = limited.map((entry) => log_render_item(entry, false)).join("");
}

function log_push(message: string, detail = "", open = true): void {
    logs.unshift({ id: log_next_id++, message, detail, time: Date.now() });
    if (logs.length > 500) logs.length = 500;
    if (open && logs_state === "collapsed") log_state_set("peek");
    else logs_render();
}

function logs_open_item(id: number): void {
    for (const item of logs_list.children) {
        const el = item as HTMLElement;
        el.classList.toggle("is_open", Number(el.dataset.id) === id);
    }
}

logs_trigger.addEventListener("click", () => {
    if (logs_state === "collapsed") log_state_set("expanded");
});

logs_panel.addEventListener("click", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".log_item");
    if (item) {
        logs_open_item(Number(item.dataset.id));
        return;
    }
    if (logs_state === "peek") log_state_set("expanded");
});

logs_list.addEventListener("scroll", () => {
    if (logs_state !== "expanded") return;
    const el = logs_list;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
        logs_visible += LOG_PAGE;
        logs_render();
    }
});

document.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    if (logs_state === "collapsed") return;
    if (target.closest(".logs")) return;
    log_state_set("collapsed");
});

async function document_process(file: File): Promise<void> {

    const doc = {
        id:      `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title:   file.name.replace(/\.[^.]+$/, ""),
        content: await file.text()
    };

    // Chunks
    const chunks = text_chunk_document(doc);

    // Embedding
    const infer = await infer_get();

    if (!infer.setting.ready) {
        const local = await infer_local_available();
        infer_phase_set(local ? "load" : "download");
    }
    let vecs: number[][];
    try {
        vecs = await infer.encode(chunks.map((c) => c.content));
    } finally {
        infer_phase_set(null);
    }
    infer_ui_sync(infer.setting);
    
    // Records: Chunks + Embedding + Metadata
    const records  = chunks.map((c, i) => ({
        id: `${doc.id}_chunk${i}`,
        content: c.content,
        embedding: vecs[i],
        meta: { id_document: doc.id, idx_chunk: i },
    }));
    const preview = doc.content.trim().replace(/\s+/g, " ");

    await json_post("/api/ingest", {
        doc: {
            id:          doc.id,
            title:       doc.title,
            preview:     preview,
            chunk_count: records.length,
            content:     doc.content
        },
        chunks: records,
    });
    log_push(`处理成功：${doc.title}`, `${records.length} 个切片已写入知识库`);
}

async function index_flush(): Promise<void> {
    try {
        await json_post("/api/index/flush", {});
    } catch (error) {
        log_push("索引刷新失败", String(error));
    }
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
        log_push("无法加载知识库", String(error));
    }

    doc_count.textContent = String(docs.length);

    mount_waterfall(doc_list, docs.length === 0 ? "" : render_lib_items(docs), render_lib_empty());
    refresh_icons();
}

function file_title(name: string): string {
    return name.replace(/\.[^.]+$/, "");
}

function ingest_cards_render(): void {
    page_ingest_cards_render();
    ingest_spin_sync();
}

function ingest_spin_sync(): void {
    const entry = page_switchs_content.get("ingest");
    if (!entry) return;
    const busy =
        documents_ingest_busy ||
        documents_ingest_cards.some((it) => it.status === "run" || it.status === "wait");
    entry.btn.dataset.spin = busy ? "true" : "false";
}

async function documents_ingest_loop(): Promise<void> {
    while (documents_ingest.length > 0) {
        const file = documents_ingest.shift();
        if (!file) break;
        const task = documents_ingest_cards.find((it) => it.status === "wait");
        if (task) task.status = "run";
        ingest_cards_render();
        try {
            await document_process(file);
            if (task) task.status = "done";
        } catch (error) {
            log_push("处理失败", String(error));
            if (task) task.status = "done";
        }
        ingest_cards_render();
    }
    documents_ingest_busy = false;
    ingest_spin_sync();
    await index_flush();
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
    if (files.length === 0) return;

    documents_ingest_cards = documents_ingest_cards.filter(
        (it) => it.status === "run" || it.status === "wait",
    );
    for (const file of files) {
        documents_ingest.push(file);
        documents_ingest_cards.push({
            id: `ingest_${ingest_task_id++}`,
            title: file_title(file.name),
            status: "wait",
        });
    }
    ingest_cards_render();
    if (!documents_ingest_busy) {
        documents_ingest_busy = true;
        void documents_ingest_loop();
    }
}

function show_initial_state(): void {
    results_list.replaceChildren(initial_state);
}

// Search

// 检索方式：左右分段切换（混合 / 向量），不可滑动切换。

function mode_toggle_create(
    host: HTMLElement,
    options: { value: SearchMode; label: string }[],
    initial: SearchMode,
    on_change: (value: SearchMode) => void,
): void {
    let value: SearchMode = initial;

    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "检索方式");

    const thumb = document.createElement("span");
    thumb.className = "seg_thumb";
    thumb.setAttribute("aria-hidden", "true");
    seg.appendChild(thumb);

    const buttons = options.map((option) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "seg_btn";
        btn.dataset.value = option.value;
        btn.textContent = option.label;
        btn.addEventListener("click", () => {
            if (option.value === value) return;
            value = option.value;
            sync();
            on_change(value);
        });
        seg.appendChild(btn);
        return { option, btn };
    });

    function sync(): void {
        seg.dataset.index = String(buttons.findIndex((n) => n.option.value === value));
        for (const { option, btn } of buttons) {
            const active = option.value === value;
            btn.classList.toggle("is_active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        }
    }

    host.replaceChildren(seg);
    sync();
}

function search_init(): void {
    mode_toggle_create(search_mode_dd, SEARCH_MODE_OPTIONS, SEARCH_SETTING_DEFAULT.mode, (value) => {
        search_mode_value = value;
    });
    top_k_input.min = String(SEARCH_SETTING_DEFAULT.top_k_min);
    top_k_input.max = String(SEARCH_SETTING_DEFAULT.top_k_max);
    top_k_input.value = String(SEARCH_SETTING_DEFAULT.top_k);
}

async function search_execute(): Promise<void> {
    const query = search_input.value.trim();
    if (!query) return;

    const top_k = search_topk_read();

    let hits: SearchHit[];
    try {
        const infer = await infer_get();
        const vec = (await infer.encode([query]))[0];
        const res = (await json_post("/api/search", { vec, top_k, mode: search_mode_value, query })) as { hits: SearchHit[] };
        hits = (res.hits ?? []) as SearchHit[];
    } catch (error) {
        log_push("检索失败", String(error));
        return;
    }

    if (hits.length === 0) {
        log_push("没有找到相关内容", "换个说法再试");
        return;
    }

    const collection = document.createElement("div");
    collection.className = "result_collection";
    collection.innerHTML = render_result_collection(hits);
    results_list.appendChild(collection);

    masonry_into(collection, hits.length <= 4 ? 2 : hits.length <= 8 ? 3 : 4);

    page_apply_focus(collection);
    page_bind();
    dock_search();
    refresh_icons();
}

let page_focus = -1;
let page_handlers = false;

function page_scroller_get(): HTMLElement | null {
    return results_list.closest<HTMLElement>(".results");
}

function page_apply_focus(el: HTMLElement): void {
    const sc = page_scroller_get();
    if (!sc) return;
    const cols = Array.from(sc.querySelectorAll<HTMLElement>(".result_collection"));
    page_focus = cols.indexOf(el);
    requestAnimationFrame(() => {
        const view = sc.clientHeight;
        const rect = el.getBoundingClientRect();
        const view_top = sc.getBoundingClientRect().top;
        const last = page_focus === cols.length - 1;
        const tall = rect.height >= view * 0.9;
        const target =
            last || tall
                ? sc.scrollTop + (rect.top - view_top) - 24
                : sc.scrollTop + (rect.top - view_top) + rect.height / 2 - view / 2;
        sc.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    });
}

function page_bind(): void {
    const sc = page_scroller_get();
    if (!sc || page_handlers) return;
    page_handlers = true;
    sc.addEventListener(
        "wheel",
        (event) => {
            const cols = Array.from(sc.querySelectorAll<HTMLElement>(".result_collection"));
            if (cols.length === 0) return;
            if (page_focus < 0 || !cols[page_focus]) return;
            const g = cols[page_focus];
            const st = sc.scrollTop;
            const view = sc.clientHeight;
            const dir = event.deltaY > 0 ? 1 : -1;
            const g_top = g.offsetTop;
            const g_bottom = g_top + g.offsetHeight;
            const tall = g.offsetHeight > view;

            if (dir === 1) {
                if (tall && g_bottom - st - view > 16) return;
                event.preventDefault();
                if (page_focus < cols.length - 1) page_apply_focus(cols[page_focus + 1]);
            } else {
                if (tall && st - g_top > 16) return;
                event.preventDefault();
                if (page_focus > 0) page_apply_focus(cols[page_focus - 1]);
            }
        },
        { passive: false },
    );
}

function masonry_into(container: HTMLElement, cols: number): void {
    const cards = Array.from(container.children) as HTMLElement[];
    const columns: HTMLElement[] = [];
    container.innerHTML = "";
    for (let i = 0; i < cols; i++) {
        const col = document.createElement("div");
        col.className = "result_column";
        container.appendChild(col);
        columns.push(col);
    }
    if (!cards.length) return;
    columns[0].append(...cards);
    void container.offsetHeight;
    const heights = cards.map((c) => c.offsetHeight);
    columns[0].innerHTML = "";
    const heights_sum = new Array(cols).fill(0);
    cards.forEach((card, i) => {
        let min = 0;
        for (let j = 1; j < cols; j++) {
            if (heights_sum[j] < heights_sum[min]) min = j;
        }
        columns[min].appendChild(card);
        heights_sum[min] += heights[i];
    });
}

function dock_search(): void {
    if (searchdock_docked) return;
    searchdock_docked = true;
    searchdock.classList.add("is_docked");
}

function search_topk_read(): number {
    return Math.min(
        SEARCH_SETTING_DEFAULT.top_k_max,
        Math.max(SEARCH_SETTING_DEFAULT.top_k_min, parseInt(top_k_input.value, 10) || SEARCH_SETTING_DEFAULT.top_k),
    );
}

function search_topk_modifier_update(): void {
    const value = search_topk_read();
    top_k_dec.disabled = value <= SEARCH_SETTING_DEFAULT.top_k_min;
    top_k_inc.disabled = value >= SEARCH_SETTING_DEFAULT.top_k_max;
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
    } else {
        entry.btn.classList.remove("is_active");
        entry.btn.style.removeProperty("width");
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
    page_switch.appendChild(page_switch_button_create("home", "upload-cloud", "我的内容"));
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

btn_search.addEventListener("click", search_execute);

sidebar_toggle.addEventListener("click", () => sidebar_collapsed_set(!sidebar_collapsed));
reader_close.addEventListener("click", () => reader_visible_set(false));

top_k_dec.addEventListener("click", () => search_topk_update(search_topk_read() - 1));
top_k_inc.addEventListener("click", () => search_topk_update(search_topk_read() + 1));
top_k_input.addEventListener("input", search_topk_modifier_update);
top_k_input.addEventListener("change", () => search_topk_update(search_topk_read()));

search_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") search_execute();
});

doc_list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest<HTMLElement>(".doc_card_more")) return;
    const card = target.closest<HTMLElement>(".doc_card");
    if (!card) return;
    const key = card.dataset.key;
    if (!key) return;
    if (!page_reader.hidden && reader_doc_id === key) {
        reader_visible_set(false);
        return;
    }
    const title = card.querySelector<HTMLElement>(".doc_card_title")?.textContent ?? "";
    void reader_open(key, title);
});

queue_shelf.addEventListener("click", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".doc_card");
    if (!card) return;
    const key = card.dataset.key;
    if (!key) return;
    page_ingest_cards_status_sync(key);
});

// Card menu

let card_menu_doc: string | null = null;

function card_menu_hide(): void {
    card_menu.classList.remove("is_open");
    card_menu_doc = null;
}

doc_list.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    const more = target.closest<HTMLElement>(".doc_card_more");
    if (more) {
        const card = more.closest<HTMLElement>(".doc_card");
        card_menu_doc = card?.dataset.key ?? null;
        const rect = more.getBoundingClientRect();
        const sidebar = card_menu.closest<HTMLElement>(".sidebar");
        const srect = sidebar?.getBoundingClientRect();
        const left = srect ? rect.right - srect.left - 132 : rect.left;
        const top = srect ? rect.top - srect.top : rect.top;
        card_menu.style.left = `${left}px`;
        card_menu.style.top = `${top}px`;
        card_menu.classList.remove("is_open");
        void card_menu.offsetWidth;
        card_menu.classList.add("is_open");
        return;
    }
    if (!target.closest(".card_menu")) card_menu_hide();
});

card_menu_delete.addEventListener("click", async () => {
    const id = card_menu_doc;
    card_menu_hide();
    if (!id) return;
    try {
        await json_delete(`/api/document?id=${encodeURIComponent(id)}`);
        document_opening.delete(id);
        await documents_refresh();
        log_push("已删除文档", "已从知识库移除");
    } catch (error) {
        log_push("删除失败", String(error));
    }
});

page_switchs_button_create();
page_ingest_cards_render();
ingest_spin_sync();
refresh_icons();
infer_ui_sync();
search_init();
search_topk_modifier_update();
reader_visible_set(false);
sidebar_collapsed_set(false);
show_initial_state();
void documents_refresh();
