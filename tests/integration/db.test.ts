// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    chunks_add,
    chunks_delete_by_document,
    chunks_hybrid_search,
    chunks_refresh_if_dirty,
    chunks_search,
    db_close,
    document_content_get,
    document_contents_add,
    document_contents_delete,
    document_find_by_hash,
    documents_add,
    documents_delete,
    documents_list,
} from "../../server/db/db";
import { chunk_record, embedding_at } from "../helpers/vectors";
import { test_env_create, test_env_remove, type TestEnv } from "../helpers/env";

const CONTENT_SEEKDB = "Memoria 使用 seekdb 完成混合检索。";
const CONTENT_BROWSER = "端侧模型在浏览器中运行。";

let env: TestEnv;
let previous_db: string | undefined;
let previous_models: string | undefined;

describe("seekdb data layer", () => {
    beforeAll(async () => {
        previous_db = process.env.MEMORIA_DB_PATH;
        previous_models = process.env.MEMORIA_MODEL_ROOT;
        env = await test_env_create();
    });

    afterAll(async () => {
        await db_close();
        if (env) await test_env_remove(env);

        if (previous_db === undefined) delete process.env.MEMORIA_DB_PATH;
        else process.env.MEMORIA_DB_PATH = previous_db;

        if (previous_models === undefined) delete process.env.MEMORIA_MODEL_ROOT;
        else process.env.MEMORIA_MODEL_ROOT = previous_models;
    });

    it("writes documents, contents and chunks", async () => {
        await documents_add({
            id: "doc-db",
            title: "Memoria",
            preview: CONTENT_SEEKDB,
            chunk_count: 2,
            content_hash: "hash-db-1",
        });
        await document_contents_add("doc-db", `${CONTENT_SEEKDB}\n\n${CONTENT_BROWSER}`);

        expect(await documents_list()).toMatchObject([
            { id: "doc-db", title: "Memoria", chunk_count: 2 },
        ]);
        expect(await document_find_by_hash("hash-db-1")).toMatchObject({ id: "doc-db" });
        expect(await document_content_get("doc-db")).toContain(CONTENT_SEEKDB);

        await chunks_add([
            chunk_record("doc-db_chunk0", CONTENT_SEEKDB, "doc-db", 0, embedding_at(0), 0, CONTENT_SEEKDB.length),
            chunk_record("doc-db_chunk1", CONTENT_BROWSER, "doc-db", 1, embedding_at(1), 0, CONTENT_BROWSER.length),
        ]);
    });

    it("refreshes the index and returns semantic and hybrid results", async () => {
        expect(await chunks_refresh_if_dirty()).toBe(true);
        expect(await chunks_refresh_if_dirty()).toBe(false);

        const semantic = await chunks_search(embedding_at(0), 2);
        expect(semantic.ids[0]?.[0]).toBe("doc-db_chunk0");
        expect(semantic.documents?.[0]?.[0]).toBe(CONTENT_SEEKDB);
        expect(semantic.metadatas?.[0]?.[0]).toMatchObject({
            id_document:  "doc-db",
            idx_chunk:    0,
            offset_start: 0,
            offset_end:   CONTENT_SEEKDB.length,
        });

        const hybrid = await chunks_hybrid_search("seekdb", embedding_at(0), 2);
        expect(hybrid.documents?.[0]?.some((content) => content?.includes("seekdb"))).toBe(true);
    });

    it("removes chunks, document metadata and contents", async () => {
        await chunks_delete_by_document("doc-db");
        await documents_delete("doc-db");
        await document_contents_delete("doc-db");

        const semantic = await chunks_search(embedding_at(0), 2);
        expect(semantic.ids[0]?.length ?? 0).toBe(0);
        expect(await documents_list()).toEqual([]);
        expect(await document_content_get("doc-db")).toBeNull();
        expect(await document_find_by_hash("hash-db-1")).toBeNull();
    });
});
