// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { describe, expect, it } from "vitest";
import {
    render_lib_item,
    render_reader_document,
    render_result_collection,
} from "../../src/ui/render";

describe("render_lib_item", () => {
    it("escapes document title and preview", () => {
        const html = render_lib_item({
            id: `doc-"1"`,
            title: "<script>alert(1)</script>",
            preview: "a & b",
            chunk_count: 2,
        });

        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("a &amp; b");
        expect(html).toContain("2 切片");
    });
});

describe("render_result_collection", () => {
    it("keeps result order, escapes chunk content and exposes source metadata", () => {
        const html = render_result_collection([
            {
                content: "<b>first</b>",
                pct: 80,
                id_document: "doc-1",
                idx_chunk: 0,
                offset_start: 0,
                offset_end: 7,
                title: "First",
            },
            {
                content: "second",
                pct: 40,
                id_document: "doc-2",
                idx_chunk: 1,
                offset_start: 8,
                offset_end: 14,
                title: "Second",
            },
        ]);

        expect(html.indexOf("80")).toBeLessThan(html.indexOf("40"));
        expect(html).toContain("&lt;b&gt;first&lt;/b&gt;");
        expect(html).toContain('data-doc="doc-1"');
        expect(html).toContain('data-offset-start="0"');
        expect(html).toContain('data-offset-end="7"');
    });
});

describe("render_reader_document", () => {
    it("renders escaped paragraphs", () => {
        const html = render_reader_document("first\n\n<script>alert(1)</script>");

        expect(html.match(/reader_paragraph/g)).toHaveLength(2);
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain('data-start="0"');
        expect(html).toContain('data-start="7"');
    });
});
