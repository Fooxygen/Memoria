
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { text_escape_regexp } from "./text";
import type { SearchMode } from "./settings";

export function score_chunk(text: string, query: string, mode: SearchMode): number {
    const text_lower = text.toLowerCase();
    const query_lower = query.toLowerCase();
    const terms = query_lower.split(/\s+/).filter((t) => t.length > 0);

    let keyword_score = 0;

    for (const term of terms) {
        if (text_lower.includes(term)) {
            keyword_score += 0.35;
            const matches = text_lower.match(new RegExp(text_escape_regexp(term), "g"));
            if (matches) keyword_score += matches.length * 0.15;
        }
    }

    let character_overlap = 0;
    for (const char of query) {
        if (text_lower.includes(char.toLowerCase())) character_overlap++;
    }
    const semantic_sim = (character_overlap / Math.max(query.length, 1)) * 0.4;

    let score = keyword_score + semantic_sim;
    if (mode === "keyword") {
        score *= 0.8;
    } else if (mode === "semantic") {
        score = semantic_sim + Math.random() * 0.1;
    }
    return score;
}
