// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { describe, expect, it } from "vitest";
import { text_chunk_document, text_escape_html, text_hash_content } from "../../src/store/text";

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
});
