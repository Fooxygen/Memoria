
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ResultHit, SourceDoc, TextChunk } from "./types";
import { text_escape_html, text_highlight } from "./text";

export function render_lib_items(docs: SourceDoc[], chunks: TextChunk[]): string {
    return docs
        .map((doc) => {
            const count = chunks.filter((c) => c.doc_title === doc.title).length;
            return `
                <div class="lib_item card" role="listitem">
                    <span class="lib_item_title">
                        <i data-lucide="file-text" width="14" height="14" aria-hidden="true"></i>
                        <span class="lib_item_name" title="${text_escape_html(doc.title)}">${text_escape_html(doc.title)}</span>
                    </span>
                    <span class="lib_item_count">${count} 切片</span>
                </div>`;
        })
        .join("");
}

export function render_lib_empty(): string {
    return `
        <div class="lib_empty">
            <i data-lucide="folder-open" width="28" height="28" aria-hidden="true"></i>
            <p>暂无本地文档</p>
        </div>`;
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
            <p class="empty_title">未找到匹配的知识切片</p>
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
