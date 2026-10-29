
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

export interface SourceDoc {
    id: string;
    title: string;
    content: string;
}

export interface TextChunk {
    id: string;
    content: string;
    offset_start: number;
    offset_end: number;
}

