
//  Memoria
//  Copyright (c) 2026 BaseTUT.
//  Licensed under the MIT License.

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

const DB_PATH = "./data/db";
const DB_NAME = "memoria";

// Data

const TABLE_DOCUMENTS   = "documents";
const COLLECTION_CHUNKS = "chunks";

// Embedding

const embedding_dim = 384;
const embedding_dis = "inner_product";

// Global

let client:            SeekdbClient | null = null;
let collection_chunks: Collection   | null = null;

// Database

async function db_init() {
    const client_admin = new SeekdbAdminClient({ path: DB_PATH });
    try {
        await client_admin.createDatabase(DB_NAME);
    } catch {}
    await client_admin.close();
}

export async function db_client_get() : Promise<SeekdbClient> {
    if (!client) {
        await db_init();
        client = new SeekdbClient({
            path: DB_PATH,
            database: DB_NAME
        });
    }
    return client;
}

export async function db_close() {
    await client?.close();
    client = null;
    collection_chunks = null;
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
        });
    }
    return collection_chunks;
}

export async function chunks_add(records: ChunkRecord[]) {
    const chunk = await chunks_get();
    await chunk.add({
        ids:        records.map(r => r.id),
        documents:  records.map(r => r.content),
        embeddings: records.map(r => r.embedding),
        metadatas:  records.map(r => r.meta)
    });
    await chunk.refresh_index();
}

export async function chunks_search(vec: number[], result_limit: number = 5) {
    const c = await chunks_get();
    return await c.query({
        queryEmbeddings: [vec],
        nResults:        result_limit,
        include:         ["documents", "metadatas", "distances"],
    });
}

export async function chunks_hybrid_search(query: string, vec: number[], result_limit: number = 5) {
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
            id    varchar(255) primary key,
            title varchar(255),
            preview text,
            chunk_count int
        )    
    `);
}

export async function documents_add(meta: DocumentMeta) {
    const cl = await db_client_get();
    await documents_create();
    await cl.execute(`
        insert into ${TABLE_DOCUMENTS} values (?, ?, ?, ?)    
    `, [meta.id, meta.title, meta.preview, meta.chunk_count]);
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
}

export async function documents_list() : Promise<DocumentMeta[]> {
    const cl = await db_client_get();
    await documents_create();
    
    const rows = await cl.execute(`
        select id, title, preview, chunk_count from ${TABLE_DOCUMENTS}    
    `)  as Record<string, unknown>[] | null;
    if (!rows) return [];
    return rows.map(r => ({
        id:           String(r.id),
        title:        String(r.title),
        preview:      String(r.preview ?? ""),
        chunk_count:  Number(r.chunk_count ?? 0),
    }));
}
