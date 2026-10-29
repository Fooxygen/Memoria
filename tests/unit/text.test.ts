// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { describe, expect, it } from "vitest";
import {
    TEXT_CHUNK_MAX_CHARS,
    text_chunk_document,
    text_escape_html,
    text_hash_content,
} from "../../src/store/text";

describe("text_escape_html", () => {
    it("escapes html-sensitive characters", () => {
        expect(text_escape_html(`<a href="x">'&'</a>`))
            .toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    });
});

describe("text_hash_content", () => {
    it("is deterministic and differs for different content", () => {
        const first = text_hash_content("Memoria seekdb");
        expect(text_hash_content("Memoria seekdb")).toBe(first);
        expect(text_hash_content("Memoria seekdb!")).not.toBe(first);
    });

    it("returns a hexadecimal hash that fits the metadata column", () => {
        const hash = text_hash_content("混合检索");
        expect(hash).toMatch(/^[0-9a-f]+$/);
        expect(hash.length).toBeLessThanOrEqual(16);
    });
});

describe("text_chunk_document", () => {
    it("splits blank-line paragraphs, trims content and keeps ids unique", () => {
        const chunks = text_chunk_document({
            id: "doc-test",
            title: "Test",
            content: "  first paragraph  \n\n\n second paragraph \n\n   ",
        });

        expect(chunks.map((chunk) => chunk.content)).toEqual(["first paragraph", "second paragraph"]);
        expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
    });

    it("does not emit empty chunks", () => {
        const chunks = text_chunk_document({
            id: "doc-empty",
            title: "Empty",
            content: "\n\n   \n\n",
        });
        expect(chunks).toEqual([]);
    });

    it("keeps offsets aligned with the original content", () => {
        const content = "  first paragraph  \n\n\n second paragraph \n\n   ";
        const chunks = text_chunk_document({ id: "doc-offset", title: "Offset", content });

        for (const chunk of chunks) {
            expect(content.slice(chunk.offset_start, chunk.offset_end)).toBe(chunk.content);
        }
    });

    it("hard-splits long CJK paragraphs without losing content", () => {
        const content = "中".repeat(1000);
        const chunks = text_chunk_document({ id: "doc-cjk", title: "CJK", content });

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.map((chunk) => chunk.content).join("")).toBe(content);
        for (const chunk of chunks) {
            expect(chunk.content.length).toBeLessThanOrEqual(TEXT_CHUNK_MAX_CHARS);
            expect(content.slice(chunk.offset_start, chunk.offset_end)).toBe(chunk.content);
        }
    });

    it("prefers sentence boundaries in long paragraphs", () => {
        const content = `${"中".repeat(49)}。`.repeat(10);
        const chunks = text_chunk_document({ id: "doc-sentence", title: "Sentence", content });

        for (const chunk of chunks) {
            expect(chunk.content.length).toBeLessThanOrEqual(TEXT_CHUNK_MAX_CHARS);
            expect(chunk.content.endsWith("。")).toBe(true);
        }
    });

    it("supports CRLF paragraph separators", () => {
        const content = "first\r\n\r\nsecond";
        const chunks = text_chunk_document({ id: "doc-crlf", title: "CRLF", content });

        expect(chunks.map((chunk) => chunk.content)).toEqual(["first", "second"]);
        for (const chunk of chunks) {
            expect(content.slice(chunk.offset_start, chunk.offset_end)).toBe(chunk.content);
        }
    });
});
