// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { ChunkRecord } from "../../server/db/meta.ts";

export function embedding_at(index: number): number[] {
    const vector = new Array<number>(384).fill(0);
    vector[index] = 1;
    return vector;
}

export function chunk_record(
    id: string,
    content: string,
    id_document: string,
    idx_chunk: number,
    embedding: number[],
    offset_start?: number,
    offset_end?: number,
): ChunkRecord {
    return {
        id,
        content,
        embedding,
        meta: {
            id_document,
            idx_chunk,
            ...(offset_start === undefined ? {} : { offset_start }),
            ...(offset_end === undefined ? {} : { offset_end }),
        },
    };
}
