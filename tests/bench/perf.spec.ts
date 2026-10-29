// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";

interface Measures {
    [name: string]: number[];
}

async function measures_read(page: Page): Promise<Measures> {
    const entries = await page.evaluate(() => performance.getEntriesByType("measure").map((entry) => ({
        name:      entry.name,
        duration:  entry.duration,
        startTime: entry.startTime,
    })));
    const result: Measures = {};
    for (const entry of entries) {
        if (!/^(infer|ingest|search):/.test(entry.name)) continue;
        (result[entry.name] ??= []).push(Number(entry.duration.toFixed(2)));
    }
    return result;
}

function last(values: number[] | undefined): number | null {
    return values?.at(-1) ?? null;
}

function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return Number((sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle]).toFixed(2));
}

async function query_run(page: Page, query: string): Promise<Measures> {
    const before = await page.locator(".result_collection").count();
    await page.locator("#search_input").fill(query);
    await page.locator("#btn_search").click();
    await expect(page.locator(".result_collection")).toHaveCount(before + 1, { timeout: 90_000 });
    return measures_read(page);
}

async function query_page(browser: Browser, url: string, force_wasm: boolean): Promise<{
    backend: string;
    first: Measures;
    warm: Measures[];
}> {
    const context = await browser.newContext({ baseURL: url });
    if (force_wasm) {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
        });
    }
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#rt_backend")).toHaveText("待加载");

    const first = await query_run(page, "Apple");
    const backend = (await page.locator("#rt_backend").textContent())?.trim() ?? "";
    const warm: Measures[] = [];
    for (const query of ["Xcode", "Swift", "Vision Pro"]) {
        warm.push(await query_run(page, query));
    }
    await context.close();
    return { backend, first, warm };
}

test("measures import and query latency", async ({ browser }) => {
    const url = "http://127.0.0.1:4174";

    const import_context = await browser.newContext({ baseURL: url });
    const import_page = await import_context.newPage();
    await import_page.goto("/");
    await expect(import_page.locator("#rt_backend")).toHaveText("待加载");
    await import_page.locator("#file_input").setInputFiles(
        resolve("example/Apple_推出全新智能框架与先进工具助力_App_开发.txt"),
    );
    await expect(import_page.locator("#doc_count")).toHaveText("1", { timeout: 90_000 });
    const import_measures = await measures_read(import_page);
    const import_backend = (await import_page.locator("#rt_backend").textContent())?.trim() ?? "";
    await import_context.close();

    const webgpu = await query_page(browser, url, false);
    const wasm = await query_page(browser, url, true);

    const import_result = {
        backend:        import_backend,
        read_ms:        last(import_measures["ingest:read"]),
        model_load_ms:  last(import_measures["infer:load"]),
        encode_ms:      last(import_measures["ingest:encode"]),
        write_ms:       last(import_measures["ingest:write"]),
        flush_ms:       last(import_measures["ingest:flush"]),
        total_ms:       last(import_measures["ingest:total"]),
    };

    function query_result(run: { backend: string; first: Measures; warm: Measures[] }) {
        return {
            backend: run.backend,
            first: {
                load_ms:   last(run.first["infer:load"]),
                encode_ms: last(run.first["search:encode"]),
                api_ms:    last(run.first["search:api"]),
                total_ms:  last(run.first["search:total"]),
            },
            warm: {
                encode_ms: median(run.warm.map((item) => last(item["search:encode"])).filter((value): value is number => value !== null)),
                api_ms:    median(run.warm.map((item) => last(item["search:api"])).filter((value): value is number => value !== null)),
                total_ms:  median(run.warm.map((item) => last(item["search:total"])).filter((value): value is number => value !== null)),
            },
        };
    }

    const result = {
        generated_at: new Date().toISOString(),
        browser:      "Microsoft Edge (Playwright)",
        corpus:       "example/Apple_推出全新智能框架与先进工具助力_App_开发.txt",
        import:       import_result,
        webgpu:       query_result(webgpu),
        wasm:         query_result(wasm),
    };

    await mkdir("bench/results", { recursive: true });
    await writeFile(join("bench/results", "performance.json"), `${JSON.stringify(result, null, 2)}\n`);

    const lines = [
        "# Performance",
        "",
        `Browser: ${result.browser}`,
        `Corpus: ${result.corpus}`,
        "",
        `| Stage | Default (${result.webgpu.backend}) | Forced WASM |`,
        "| --- | ---: | ---: |",
        `| Model load (first query) | ${result.webgpu.first.load_ms ?? "n/a"} ms | ${result.wasm.first.load_ms ?? "n/a"} ms |`,
        `| Query encode (first) | ${result.webgpu.first.encode_ms ?? "n/a"} ms | ${result.wasm.first.encode_ms ?? "n/a"} ms |`,
        `| Query encode (warm median) | ${result.webgpu.warm.encode_ms ?? "n/a"} ms | ${result.wasm.warm.encode_ms ?? "n/a"} ms |`,
        `| seekdb search API (warm median) | ${result.webgpu.warm.api_ms ?? "n/a"} ms | ${result.wasm.warm.api_ms ?? "n/a"} ms |`,
        `| End-to-end query (first) | ${result.webgpu.first.total_ms ?? "n/a"} ms | ${result.wasm.first.total_ms ?? "n/a"} ms |`,
        `| End-to-end query (warm median) | ${result.webgpu.warm.total_ms ?? "n/a"} ms | ${result.wasm.warm.total_ms ?? "n/a"} ms |`,
        "",
        "Document import (first backend):",
        "",
        `| Read | Model load | Encode | Write | Index flush | Total |`,
        `| ---: | ---: | ---: | ---: | ---: | ---: |`,
        `| ${import_result.read_ms ?? "n/a"} | ${import_result.model_load_ms ?? "n/a"} | ${import_result.encode_ms ?? "n/a"} | ${import_result.write_ms ?? "n/a"} | ${import_result.flush_ms ?? "n/a"} | ${import_result.total_ms ?? "n/a"} |`,
        "",
        `All values in milliseconds. Query warm median uses three queries: Xcode, Swift, Vision Pro.`,
    ];
    await writeFile(join("bench/results", "performance.md"), `${lines.join("\n")}\n`);

    expect(webgpu.first.total_ms).not.toBeNull();
    expect(wasm.first.total_ms).not.toBeNull();
});
