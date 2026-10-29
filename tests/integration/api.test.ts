// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { test_api_start, type TestApi } from "../helpers/api";
import { test_env_create, test_env_remove, type TestEnv } from "../helpers/env";
import { chunk_record, embedding_at } from "../helpers/vectors";

const DOC_ID = "doc-api";
const CONTENT_SEEKDB = "Memoria 使用 seekdb 完成混合检索。";
const CONTENT_BROWSER = "端侧模型在浏览器中运行。";

let api: TestApi;
let env: TestEnv;
let previous_db: string | undefined;
let previous_models: string | undefined;

async function post_json(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("memoria HTTP API", () => {
    beforeAll(async () => {
        previous_db = process.env.MEMORIA_DB_PATH;
        previous_models = process.env.MEMORIA_MODEL_ROOT;
        env = await test_env_create();
        api = await test_api_start();
    });

    afterAll(async () => {
        await api?.close();
        if (env) await test_env_remove(env);

        if (previous_db === undefined) delete process.env.MEMORIA_DB_PATH;
        else process.env.MEMORIA_DB_PATH = previous_db;

        if (previous_models === undefined) delete process.env.MEMORIA_MODEL_ROOT;
        else process.env.MEMORIA_MODEL_ROOT = previous_models;
    });

    it("serves health and an empty document list", async () => {
        const health = await fetch(`${api.url}/api/health`);
        expect(health.status).toBe(200);
        expect(await health.json()).toEqual({ ok: true });

        const documents = await fetch(`${api.url}/api/documents`);
        expect(await documents.json()).toEqual({ documents: [] });
    });

    it("ingests a document, refreshes the index and returns its content", async () => {
        const ingest = await post_json(`${api.url}/api/ingest`, {
            doc: {
                id: DOC_ID,
                title: "Memoria API",
                preview: CONTENT_SEEKDB,
                chunk_count: 2,
                content: `${CONTENT_SEEKDB}\n\n${CONTENT_BROWSER}`,
                content_hash: "hash-api-1",
            },
            chunks: [
                chunk_record("doc-api_chunk0", CONTENT_SEEKDB, DOC_ID, 0, embedding_at(0), 0, CONTENT_SEEKDB.length),
                chunk_record("doc-api_chunk1", CONTENT_BROWSER, DOC_ID, 1, embedding_at(1), CONTENT_SEEKDB.length + 2, CONTENT_SEEKDB.length + 2 + CONTENT_BROWSER.length),
            ],
        });

        expect(ingest.status).toBe(200);
        expect(await ingest.json()).toEqual({ ok: true });

        const flush = await post_json(`${api.url}/api/index/flush`, {});
        expect(await flush.json()).toEqual({ ok: true, refreshed: true });

        const documents = await fetch(`${api.url}/api/documents`);
        const document_data = (await documents.json()) as { documents: { id: string }[] };
        expect(document_data.documents.map((document) => document.id)).toEqual([DOC_ID]);

        const content = await fetch(`${api.url}/api/document/content?id=${DOC_ID}`);
        expect(content.status).toBe(200);
        expect(await content.json()).toMatchObject({ id: DOC_ID });
    });

    it("skips duplicate content by hash", async () => {
        const duplicate = await post_json(`${api.url}/api/ingest`, {
            doc: {
                id: "doc-api-duplicate",
                title: "Duplicate",
                preview: "",
                chunk_count: 0,
                content: "",
                content_hash: "hash-api-1",
            },
            chunks: [],
        });

        expect(await duplicate.json()).toEqual({
            ok: false,
            duplicate: true,
            title: "Memoria API",
        });
    });

    it("returns semantic and hybrid search hits", async () => {
        const semantic = await post_json(`${api.url}/api/search`, {
            vec: embedding_at(0),
            top_k: 5,
            mode: "semantic",
            query: "seekdb",
        });
        const semantic_data = (await semantic.json()) as {
            hits: {
                content:      string;
                id_document:  string;
                offset_start: number;
                offset_end:   number;
                title:        string;
            }[];
        };
        expect(semantic_data.hits[0]).toMatchObject({
            content:      expect.stringContaining("seekdb"),
            id_document:  DOC_ID,
            offset_start: 0,
            offset_end:   CONTENT_SEEKDB.length,
            title:        "Memoria API",
        });

        const hybrid = await post_json(`${api.url}/api/search`, {
            vec: embedding_at(0),
            top_k: 5,
            mode: "hybrid",
            query: "seekdb",
        });
        const hybrid_data = (await hybrid.json()) as { hits: { content: string }[] };
        expect(hybrid_data.hits.some((hit) => hit.content.includes("seekdb"))).toBe(true);
    });

    it("serves model files with HEAD and rejects unknown files", async () => {
        const model = await fetch(
            `${api.url}/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`,
            { method: "HEAD" },
        );
        expect(model.status).toBe(200);
        expect(model.headers.get("content-length")).toBe("5");

        const missing = await fetch(`${api.url}/models/unknown.onnx`, { method: "HEAD" });
        expect(missing.status).toBe(404);
    });

    it("validates requests and falls through unknown routes", async () => {
        const search = await post_json(`${api.url}/api/search`, {});
        expect(search.status).toBe(400);

        const content = await fetch(`${api.url}/api/document/content`);
        expect(content.status).toBe(400);

        const unknown = await fetch(`${api.url}/api/unknown`);
        expect(unknown.status).toBe(404);
    });

    it("deletes the document and its searchable chunks", async () => {
        const deleted = await fetch(`${api.url}/api/document?id=${DOC_ID}`, { method: "DELETE" });
        expect(deleted.status).toBe(200);

        const documents = await fetch(`${api.url}/api/documents`);
        expect(await documents.json()).toEqual({ documents: [] });

        const content = await fetch(`${api.url}/api/document/content?id=${DOC_ID}`);
        expect(content.status).toBe(404);

        const search = await post_json(`${api.url}/api/search`, {
            vec: embedding_at(0),
            top_k: 5,
            mode: "semantic",
            query: "seekdb",
        });
        expect(await search.json()).toEqual({ hits: [] });
    });
});
