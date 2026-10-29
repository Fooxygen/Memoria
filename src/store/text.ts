
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { SourceDoc, TextChunk } from "./types";

export const TEXT_CHUNK_MAX_CHARS = 300;

const TEXT_CHUNK_BREAK_RATIO = 0.6;
const TEXT_CHUNK_PUNCTUATION = /[。！？；.!?;]/;
const TEXT_WHITESPACE = /\s/;

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

function text_chunk_trim(content: string, start: number, end: number): [number, number] {
    while (start < end && TEXT_WHITESPACE.test(content[start])) start += 1;
    while (end > start && TEXT_WHITESPACE.test(content[end - 1])) end -= 1;
    return [start, end];
}

function text_chunk_break_find(content: string, from: number, to: number, pattern: RegExp): number {
    for (let i = to - 1; i >= from; i -= 1) {
        if (pattern.test(content[i])) return i + 1;
    }
    return -1;
}

function text_chunk_push(chunks: TextChunk[], doc_id: string, content: string, start: number, end: number): void {
    const [trim_start, trim_end] = text_chunk_trim(content, start, end);
    if (trim_start >= trim_end) return;

    chunks.push({
        id: `${doc_id}-c${chunks.length}`,
        content: content.slice(trim_start, trim_end),
        offset_start: trim_start,
        offset_end: trim_end,
    });
}

function text_chunk_split(chunks: TextChunk[], doc_id: string, content: string, start: number, end: number): void {
    let cursor = start;

    while (cursor < end) {
        while (cursor < end && TEXT_WHITESPACE.test(content[cursor])) cursor += 1;
        if (cursor >= end) break;

        const tentative = Math.min(cursor + TEXT_CHUNK_MAX_CHARS, end);
        let break_at = tentative;

        if (tentative < end) {
            const min_break = cursor + Math.floor(TEXT_CHUNK_MAX_CHARS * TEXT_CHUNK_BREAK_RATIO);
            const punctuation = text_chunk_break_find(content, min_break, tentative, TEXT_CHUNK_PUNCTUATION);
            const whitespace = text_chunk_break_find(content, min_break, tentative, TEXT_WHITESPACE);

            if (punctuation > cursor) break_at = punctuation;
            else if (whitespace > cursor) break_at = whitespace;
        }

        text_chunk_push(chunks, doc_id, content, cursor, break_at);
        cursor = break_at;
    }
}

export function text_chunk_document(doc: SourceDoc): TextChunk[] {
    const chunks: TextChunk[] = [];
    const content = doc.content;
    const separator = /\r?\n(?:[ \t]*\r?\n)+/g;
    let segment_start = 0;

    function segment_push(start: number, end: number): void {
        const [trim_start, trim_end] = text_chunk_trim(content, start, end);
        if (trim_start >= trim_end) return;

        if (trim_end - trim_start <= TEXT_CHUNK_MAX_CHARS) {
            text_chunk_push(chunks, doc.id, content, trim_start, trim_end);
        } else {
            text_chunk_split(chunks, doc.id, content, trim_start, trim_end);
        }
    }

    for (const match of content.matchAll(separator)) {
        const separator_start = match.index ?? 0;
        segment_push(segment_start, separator_start);
        segment_start = separator_start + match[0].length;
    }
    segment_push(segment_start, content.length);

    return chunks;
}
