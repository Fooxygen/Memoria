
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ResultHit } from "./types";
import { text_escape_html, text_highlight } from "./text";

export interface LibDoc {
    title: string;
    preview: string;
    chunk_count: number;
}

export function render_lib_items(docs: LibDoc[]): string {
    return docs
        .map((doc) => {
            return `
                <article class="doc_card card" role="listitem" data-key="${text_escape_html(doc.title)}">
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
    title: string;
    status: QueueStatus;
}

const QUEUE_STATUS_CLASS: Record<QueueStatus, string> = {
    wait: "is_wait",
    run: "is_run",
    done: "is_done",
};

const QUEUE_ACTION_ICON: Record<QueueStatus, string> = {
    wait: "x",
    run: "circle-stop",
    done: "x",
};

export function render_queue_cards(items: QueueCardItem[]): string {
    return items
        .map((it) => {
            const status_class = QUEUE_STATUS_CLASS[it.status];
            const icon = QUEUE_ACTION_ICON[it.status];
            const label = it.status === "run" ? "终止任务" : "清除记录";
            return `
                <article class="doc_card card ${status_class}" role="listitem" data-key="${text_escape_html(it.title)}">
                    <div class="doc_card_head">
                        <span class="doc_card_status" aria-hidden="true"></span>
                        <h3 class="doc_card_title" title="${text_escape_html(it.title)}">${text_escape_html(it.title)}</h3>
                    </div>
                    <button class="doc_card_action" type="button" title="${label}" aria-label="${label}">
                        <i data-lucide="${icon}"></i>
                    </button>
                </article>`;
        })
        .join("");
}

export function render_result_card(hit: ResultHit, index: number, query: string): string {
    const normalized = Math.min(Math.round(hit.score * 100), 99);
    return `
        <article class="result_card card">
            <div class="result_card_head">
                <span class="result_card_source">
                    <span class="result_card_rank">${index + 1}</span>
                    <span class="result_card_title" title="${text_escape_html(hit.doc_title)}">${text_escape_html(hit.doc_title)}</span>
                </span>
                <span class="result_card_score">
                    <span class="scorebar" aria-hidden="true">
                        <span class="scorebar_fill" style="width: ${normalized}%"></span>
                    </span>
                    <span class="result_card_pct">${normalized}% 匹配</span>
                </span>
            </div>
            <p class="result_card_text">${text_highlight(hit.content, query)}</p>
        </article>`;
}

export function render_result_empty(): string {
    return `
        <div class="empty card">
            <span class="empty_icon" aria-hidden="true"><i data-lucide="ghost"></i></span>
            <p class="empty_title">没有找到相关内容</p>
            <p class="empty_hint">尝试使用更宽泛的关键词或切换检索模式</p>
        </div>`;
}

export function render_toast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast card";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("is_visible"));

    setTimeout(() => {
        toast.classList.remove("is_visible");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
