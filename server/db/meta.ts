
//  Memoria
//  Copyright (c) 2026 BaseTUT.
//  Licensed under the MIT License.

export interface DocumentMeta {
    id:    string;
    title: string;
}

/**
 * @param id_document The Document ID linked to DocumentMeta.id
 * @param idx_chunk The Chunk Index within the document
 */
export type ChunkRecordMeta = {
    id_document: string;
    idx_chunk:   number;
} & Record<string, string | number>;

export interface ChunkRecord {
    id:        string;
    content:   string;
    embedding: number[];
    meta:      ChunkRecordMeta;
}
