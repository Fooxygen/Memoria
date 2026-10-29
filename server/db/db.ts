
//  Memoria
//  Copyright (c) 2026 BaseTUT.
//  Licensed under the MIT License.

import { resolve } from "node:path";
import {
    SeekdbAdminClient,
    SeekdbClient,
    Schema,
    VectorIndexConfig,
    FulltextIndexConfig,
    Collection
} from "seekdb";
import type {
    ChunkRecord,
    DocumentMeta
} from "./meta.ts"

// Database

function db_path_get(): string {
    return resolve(process.env.MEMORIA_DB_PATH ?? "data/db");
}

const DB_NAME = "memoria";

// Data

const TABLE_DOCUMENTS   = "documents";
const TABLE_CONTENTS    = "document_contents";
const COLLECTION_CHUNKS = "chunks";

// Embedding

const embedding_dim = 384;
const embedding_dis = "inner_product";

// Global

let client:            SeekdbClient | null = null;
let collection_chunks: Collection   | null = null;

// Database

async function db_init() {
    const client_admin = new SeekdbAdminClient({ path: db_path_get() });
    try {
        await client_admin.createDatabase(DB_NAME);
    } catch {}
    await client_admin.close();
}

export async function db_client_get() : Promise<SeekdbClient> {
    if (!client) {
        await db_init();
        client = new SeekdbClient({
            path: db_path_get(),
            database: DB_NAME
        });
    }
    return client;
}

export async function db_close() {
    await client?.close();
    client = null;
    collection_chunks = null;
    index_pending = null;
    index_refreshed = 0;
}

// Chunks

function chunks_schema_create() {
    return new Schema({

        // Semantic Search
        vectorIndex: new VectorIndexConfig({
            hnsw: { 
                dimension: embedding_dim,
                distance:  embedding_dis
            },
            embeddingFunction: null
        }),

        // FullText Search
        fulltextIndex: new FulltextIndexConfig("ik")    // word segmenter
    });
}

export async function chunks_get() {
    if (!collection_chunks) {
        const cl = await db_client_get();
        collection_chunks = await cl.getOrCreateCollection({
            name:   COLLECTION_CHUNKS,
            schema: chunks_schema_create(),
            embeddingFunction: null,
        });
    }
    return collection_chunks;
}

// Index

let index_writes:    number = 0;
let index_refreshed: number = 0;
let index_pending:   Promise<void> | null = null;

function index_mark_dirty(): void {
    index_writes += 1;
}

export async function chunks_refresh_if_dirty(): Promise<boolean> {
    let refreshed = false;

    while (index_refreshed < index_writes) {
        if (!index_pending) {
            const target = index_writes;
            index_pending = (async () => {
                const chunk = await chunks_get();
                await chunk.refresh_index();
                index_refreshed = target;
            })().finally(() => {
                index_pending = null;
            });
            refreshed = true;
        }

        await index_pending;
    }

    return refreshed;
}

export async function chunks_index_refresh(): Promise<void> {
    const target = index_writes;
    const chunk = await chunks_get();
    await chunk.refresh_index();
    if (index_refreshed < target) index_refreshed = target;
}

export async function chunks_add(records: ChunkRecord[]) {
    const chunk = await chunks_get();
    await chunk.add({
        ids:        records.map(r => r.id),
        documents:  records.map(r => r.content),
        embeddings: records.map(r => r.embedding),
        metadatas:  records.map(r => r.meta)
    });
    index_mark_dirty();
}

export async function chunks_search(vec: number[], result_limit: number = 5) {
    await chunks_refresh_if_dirty();
    const c = await chunks_get();
    return await c.query({
        queryEmbeddings: [vec],
        nResults:        result_limit,
        include:         ["documents", "metadatas", "distances"],
    });
}

export async function chunks_hybrid_search(query: string, vec: number[], result_limit: number = 5) {
    await chunks_refresh_if_dirty();
    const c = await chunks_get();
    return await c.hybridSearch({
        query: {
            whereDocument: { $contains: query },
            nResults:      result_limit,
        },
        knn: {
            queryEmbeddings: [vec],
            nResults:        result_limit,
        },
        nResults: result_limit,
        include:  ["documents", "metadatas", "distances"],
    });
}

// Documents

export async function documents_create() {
    const cl = await db_client_get();
    await cl.execute(`
        create table if not exists ${TABLE_DOCUMENTS} (
            id           varchar(255) primary key,
            title        varchar(255),
            preview      text,
            chunk_count  int,
            content_hash varchar(16)
        )    
    `);
}

export async function documents_add(meta: DocumentMeta) {
    const cl = await db_client_get();
    await documents_create();
    await cl.execute(`
        insert into ${TABLE_DOCUMENTS} values (?, ?, ?, ?, ?)    
    `, [meta.id, meta.title, meta.preview, meta.chunk_count, meta.content_hash ?? null]);
}

export async function documents_delete(id: string) {
    const cl = await db_client_get();
    await documents_create();
    await cl.execute(`
        delete from ${TABLE_DOCUMENTS} where id = ?    
    `, [id]);
}

export async function chunks_delete_by_document(id_document: string) {
    const chunk = await chunks_get();
    await chunk.delete({
        where: { id_document },
    });
    index_mark_dirty();
}

function document_meta_from_row(row: Record<string, unknown>): DocumentMeta {
    return {
        id:           String(row.id),
        title:        String(row.title ?? ""),
        preview:      String(row.preview ?? ""),
        chunk_count:  Number(row.chunk_count ?? 0),
        content_hash: row.content_hash == null ? undefined : String(row.content_hash),
    };
}

export async function documents_list() : Promise<DocumentMeta[]> {
    const cl = await db_client_get();
    await documents_create();
    
    const rows = await cl.execute(`
        select id, title, preview, chunk_count from ${TABLE_DOCUMENTS}    
    `)  as Record<string, unknown>[] | null;
    if (!rows) return [];
    return rows.map(document_meta_from_row);
}

export async function document_find_by_hash(content_hash: string): Promise<DocumentMeta | null> {
    const cl = await db_client_get();
    await documents_create();

    const rows = await cl.execute(`
        select id, title, preview, chunk_count, content_hash from ${TABLE_DOCUMENTS} where content_hash = ? limit 1
    `, [content_hash]) as Record<string, unknown>[] | null;
    if (!rows || rows.length === 0) return null;
    return document_meta_from_row(rows[0]);
}

// Document Contents

export async function document_contents_create() {
    const cl = await db_client_get();
    await cl.execute(`
        create table if not exists ${TABLE_CONTENTS} (
            id      varchar(255) primary key,
            content text
        )
    `);
}

export async function document_contents_add(id: string, content: string) {
    const cl = await db_client_get();
    await document_contents_create();
    await cl.execute(`
        insert into ${TABLE_CONTENTS} values (?, ?)
    `, [id, content]);
}

export async function document_contents_delete(id: string) {
    const cl = await db_client_get();
    await document_contents_create();
    await cl.execute(`
        delete from ${TABLE_CONTENTS} where id = ?
    `, [id]);
}

export async function document_content_get(id: string): Promise<string | null> {
    const cl = await db_client_get();
    await document_contents_create();
    const rows = await cl.execute(`
        select content from ${TABLE_CONTENTS} where id = ?
    `, [id]) as Record<string, unknown>[] | null;
    if (!rows || rows.length === 0) return null;
    return String(rows[0].content ?? "");
}
