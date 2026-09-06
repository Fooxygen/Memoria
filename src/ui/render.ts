
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { text_escape_html } from "../store/text";

export interface LibDoc {
    id: string;
    title: string;
    preview: string;
    chunk_count: number;
}

export function render_lib_items(docs: LibDoc[]): string {
    return docs
        .map((doc) => {
            return `
                <article class="doc_card card" role="listitem" data-key="${text_escape_html(doc.id)}">
                    <button class="doc_card_more" type="button" aria-label="更多操作">
                        <i data-lucide="ellipsis"></i>
                    </button>
                    <div class="doc_card_meta">${doc.chunk_count} 切片</div>
                    <h3 class="doc_card_title" title="${text_escape_html(doc.title)}">${text_escape_html(doc.title)}</h3>
                    <p class="doc_card_desc">${text_escape_html(doc.preview ?? "")}</p>
                </article>`;
        })
        .join("");
}

export function render_lib_empty(): string {
    return `<p class="doc_shelf_empty">这里还没有文档</p>`;
}

export type QueueStatus = "wait" | "run" | "done";

export interface QueueCardItem {
    id: string;
    title: string;
    status: QueueStatus;
}

const QUEUE_STATUS_CLASS: Record<QueueStatus, string> = {
    wait: "is_wait",
    run: "is_run",
    done: "is_done",
};

export function render_queue_cards(items: QueueCardItem[]): string {
    return items
        .map((it) => {
            const status_class = QUEUE_STATUS_CLASS[it.status];
            return `
                <article class="doc_card card ${status_class}" role="listitem" data-key="${text_escape_html(it.id)}">
                    <div class="doc_card_head">
                        <span class="doc_card_status" aria-hidden="true"></span>
                        <h3 class="doc_card_title" title="${text_escape_html(it.title)}">${text_escape_html(it.title)}</h3>
                    </div>
                </article>`;
        })
        .join("");
}

export interface SearchHit {
    content: string;
    pct: number;
}

export function render_result_collection(hits: SearchHit[]): string {
    return hits
        .map((hit) => {
            return `
                <article class="result_card card" data-pct="${hit.pct}">
                    <div class="result_card_score">
                        <span class="pct_num">${hit.pct}</span><span class="pct_sym">%</span>
                    </div>
                    <p class="result_card_text"><span class="quote_mark">“</span>${text_escape_html(hit.content)}<span class="quote_mark">”</span></p>
                </article>`;
        })
        .join("");
}

export function render_result_empty(): string {
    return `
        <div class="empty card">
            <span class="empty_icon" aria-hidden="true"><i data-lucide="ghost"></i></span>
            <p class="empty_title">没有找到相关内容</p>
            <p class="empty_hint">尝试使用更宽泛的关键词或切换检索模式</p>
        </div>`;
}
