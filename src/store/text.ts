
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

export function text_hash_content(text: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
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
                        content: line.trim(),
                    });
                }
            }
        } else {
            chunks.push({
                id: `${doc.id}-c${chunk_index++}`,
                content: trimmed,
            });
        }
    }

    return chunks;
}

