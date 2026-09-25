
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { SourceDoc, TextChunk } from "./types";

export function text_escape_html(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function text_chunk_document(doc: SourceDoc): TextChunk[] {
    const chunks: TextChunk[] = [];
    let chunk_index = 0;

    const paragraphs = doc.content.split(/\n\n+/);
    for (const raw of paragraphs) {
        const trimmed = raw.trim();
        if (trimmed.length === 0) continue;

        if (trimmed.length > 350) {
            const lines = trimmed.match(/.{1,300}(\s|$)|\S+?(\s|$)/g) || [trimmed];
            for (const line of lines) {
                if (line.trim().length > 0) {
                    chunks.push({
                        id: `${doc.id}-c${chunk_index++}`,
                        doc_title: doc.title,
                        content: line.trim(),
                    });
                }
            }
        } else {
            chunks.push({
                id: `${doc.id}-c${chunk_index++}`,
                doc_title: doc.title,
                content: trimmed,
            });
        }
    }

    return chunks;
}

