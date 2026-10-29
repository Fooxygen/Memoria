// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { test, expect } from "@playwright/test";

test("opens the reader from a search hit and highlights the chunk", async ({ page, request }) => {
    test.setTimeout(90_000);

    const paragraphs = Array.from({ length: 40 }, (_, index) => `第 ${index + 1} 段：Memoria 的端侧检索示例。`);
    const target_index = 25;
    const target_text = `${paragraphs[target_index]} seekdb 混合检索。`;
    paragraphs[target_index] = target_text;
    const content = paragraphs.join("\n\n");
    const offset_start = content.indexOf(target_text);

    expect(offset_start).toBeGreaterThan(0);

    const embedding = new Array<number>(384).fill(0);
    embedding[0] = 1;

    const ingest = await request.post("/api/ingest", {
        data: {
            doc: {
                id:           "doc-reader",
                title:        "Reader Test",
                preview:      target_text,
                chunk_count:  1,
                content,
                content_hash: "hash-reader",
            },
            chunks: [{
                id:        "doc-reader_chunk0",
                content:   target_text,
                embedding,
                meta: {
                    id_document:  "doc-reader",
                    idx_chunk:    0,
                    offset_start,
                    offset_end:   offset_start + target_text.length,
                },
            }],
        },
    });
    expect(ingest.ok()).toBeTruthy();
    await request.post("/api/index/flush", { data: {} });

    await page.goto("/");
    await page.locator("#search_input").fill("seekdb");
    await page.locator("#btn_search").click();

    const result = page.locator(".result_card").first();
    await expect(result).toBeVisible({ timeout: 60_000 });
    await expect(result).toContainText("seekdb");
    await result.click();

    await expect(page.locator("#page_reader")).toBeVisible();
    await expect(page.locator(".page_reader_title")).toHaveText("Reader Test");
    await expect(page.locator(".reader_highlight")).toHaveCount(1);
    await expect(page.locator(".reader_highlight")).toContainText("seekdb");

    await expect.poll(
        async () => page.locator("#page_reader_body").evaluate((element) => element.scrollTop),
        { timeout: 5_000 },
    ).toBeGreaterThan(0);
});
