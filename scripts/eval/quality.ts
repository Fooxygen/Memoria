// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pipeline, env } from "@huggingface/transformers";
import { text_chunk_document } from "../../src/store/text";
import type { TextChunk } from "../../src/store/types";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIMENSION = 384;
const TOP_K = 10;
const BATCH_SIZE = 16;
const OUT_DIR = "bench/results";
const QUERY_PATH = "bench/queries.json";

interface QueryCase {
    id:       string;
    query:    string;
    keywords: string[];
    category: string;
}

interface EvalResult {
    label:       string;
    dtype:       string;
    stages:      Record<string, number>;
    metrics:     {
        recall5: number;
        recall10: number;
        ndcg5: number;
        ndcg10: number;
        mrr: number;
    };
    per_query:   Array<{
        id:       string;
        relevant: string[];
        retrieved: string[];
        recall5:  number;
        ndcg5:    number;
        mrr:      number;
    }>;
}

interface CorpusChunk extends TextChunk {
    id_document: string;
    title:       string;
}

env.localModelPath = `${resolve("data/models")}/`;
env.allowLocalModels = true;
env.allowRemoteModels = false;

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4));
}

function recall_at(ids: string[], relevant: Set<string>, k: number): number {
    if (relevant.size === 0) return 0;
    return ids.slice(0, k).filter((id) => relevant.has(id)).length / relevant.size;
}

function ndcg_at(ids: string[], relevant: Set<string>, k: number): number {
    if (relevant.size === 0) return 0;
    const dcg = ids.slice(0, k).reduce((total, id, index) => {
        return total + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0);
    }, 0);
    const ideal = Array.from({ length: Math.min(k, relevant.size) }, (_, index) => 1 / Math.log2(index + 2))
        .reduce((total, value) => total + value, 0);
    return ideal === 0 ? 0 : dcg / ideal;
}

function mrr_at(ids: string[], relevant: Set<string>): number {
    const index = ids.findIndex((id) => relevant.has(id));
    return index < 0 ? 0 : 1 / (index + 1);
}

async function corpus_load(): Promise<{ chunks: CorpusChunk[]; queries: QueryCase[] }> {
    const files = (await readdir("example")).filter((file) => file.endsWith(".txt")).sort();
    const chunks: CorpusChunk[] = [];

    for (const [index, file] of files.entries()) {
        const content = await readFile(join("example", file), "utf8");
        const title = file.replace(/\.[^.]+$/, "");
        const id = `doc-${index}`;
        for (const chunk of text_chunk_document({ id, title, content })) {
            chunks.push({ ...chunk, id_document: id, title });
        }
    }

    const queries = JSON.parse(await readFile(QUERY_PATH, "utf8")) as QueryCase[];
    for (const query of queries) {
        const relevant = chunks.filter((chunk) =>
            query.keywords.some((keyword) => chunk.content.toLowerCase().includes(keyword.toLowerCase())),
        );
        if (relevant.length === 0) {
            throw new Error(`query ${query.id} has no relevant chunks`);
        }
    }

    console.log(`[corpus] ${chunks.length} chunks, ${queries.length} queries`);
    return { chunks, queries };
}

async function embeddings_create(
    dtype: "fp32" | "fp16" | "q8",
): Promise<{ embeddings: number[][]; query_embeddings: number[][]; stages: Record<string, number> }> {
    console.log(`[${dtype}] loading model`);
    const load_start = performance.now();
    const extractor = await pipeline("feature-extraction", MODEL, {
        device: "cpu",
        dtype,
    });
    const model_load_ms = performance.now() - load_start;
    console.log(`[${dtype}] model loaded in ${model_load_ms.toFixed(0)}ms`);

    const { chunks, queries } = await corpus_load();

    console.log(`[${dtype}] embedding documents`);
    const doc_start = performance.now();
    const embeddings: number[][] = [];
    for (let index = 0; index < chunks.length; index += BATCH_SIZE) {
        const batch = chunks.slice(index, index + BATCH_SIZE).map((chunk) => chunk.content);
        const output = await extractor(batch, { pooling: "mean", normalize: true });
        embeddings.push(...output.tolist());
    }
    const doc_embed_ms = performance.now() - doc_start;
    console.log(`[${dtype}] documents embedded in ${doc_embed_ms.toFixed(0)}ms`);

    const query_start = performance.now();
    const query_output = await extractor(queries.map((query) => query.query), {
        pooling: "mean",
        normalize: true,
    });
    const query_embeddings = query_output.tolist();
    const query_embed_ms = performance.now() - query_start;

    return {
        embeddings,
        query_embeddings,
        stages: {
            model_load_ms: Number(model_load_ms.toFixed(2)),
            doc_embed_ms:  Number(doc_embed_ms.toFixed(2)),
            query_embed_ms: Number(query_embed_ms.toFixed(2)),
        },
    };
}

async function evaluate(
    label: string,
    dtype: "fp32" | "fp16" | "q8",
): Promise<EvalResult> {
    const { chunks, queries } = await corpus_load();
    const { embeddings, query_embeddings, stages } = await embeddings_create(dtype);

    const per_query: EvalResult["per_query"] = [];
    const search_start = performance.now();

    for (const [index, query] of queries.entries()) {
        const relevant = new Set(chunks
            .filter((chunk) => query.keywords.some((keyword) =>
                chunk.content.toLowerCase().includes(keyword.toLowerCase())))
            .map((chunk) => chunk.id));
        const scores = chunks.map((chunk, chunk_index) => {
            const embedding = embeddings[chunk_index];
            let score = 0;
            for (let dimension = 0; dimension < DIMENSION; dimension += 1) {
                score += query_embeddings[index][dimension] * embedding[dimension];
            }
            return { id: chunk.id, score };
        });
        const retrieved = scores
            .sort((left, right) => right.score - left.score)
            .slice(0, TOP_K)
            .map((item) => item.id);

        per_query.push({
            id:       query.id,
            relevant: [...relevant],
            retrieved,
            recall5:  Number(recall_at(retrieved, relevant, 5).toFixed(4)),
            ndcg5:    Number(ndcg_at(retrieved, relevant, 5).toFixed(4)),
            mrr:      Number(mrr_at(retrieved, relevant).toFixed(4)),
        });
    }

    const search_ms = performance.now() - search_start;
    console.log(`[${dtype}] queries ranked in ${search_ms.toFixed(0)}ms`);

    const result: EvalResult = {
        label,
        dtype,
        stages: {
            ...stages,
            rank_ms: Number(search_ms.toFixed(2)),
        },
        metrics: {
            recall5:  mean(per_query.map((item) => item.recall5)),
            recall10: mean(per_query.map((item) => recall_at(item.retrieved, new Set(item.relevant), 10))),
            ndcg5:    mean(per_query.map((item) => item.ndcg5)),
            ndcg10:   mean(per_query.map((item) => ndcg_at(item.retrieved, new Set(item.relevant), 10))),
            mrr:      mean(per_query.map((item) => item.mrr)),
        },
        per_query,
    };

    return result;
}

async function main(): Promise<void> {
    const fp32 = await evaluate("FP32 baseline", "fp32");
    const int8 = await evaluate("INT8", "q8");

    let fp16: { error: string } | EvalResult;
    try {
        fp16 = await evaluate("FP16", "fp16");
    } catch (error) {
        fp16 = { error: String(error) };
    }

    const result = {
        generated_at: new Date().toISOString(),
        model:        MODEL,
        corpus:       {
            documents: (await readdir("example")).filter((file) => file.endsWith(".txt")).length,
            queries:   JSON.parse(await readFile(QUERY_PATH, "utf8")).length,
        },
        top_k: TOP_K,
        device: "Node.js CPU",
        results: {
            fp32,
            int8,
            fp16,
        },
        comparison: {
            recall5_delta:  Number((int8.metrics.recall5 - fp32.metrics.recall5).toFixed(4)),
            recall10_delta: Number((int8.metrics.recall10 - fp32.metrics.recall10).toFixed(4)),
            ndcg5_delta:    Number((int8.metrics.ndcg5 - fp32.metrics.ndcg5).toFixed(4)),
            ndcg10_delta:   Number((int8.metrics.ndcg10 - fp32.metrics.ndcg10).toFixed(4)),
            mrr_delta:      Number((int8.metrics.mrr - fp32.metrics.mrr).toFixed(4)),
        },
    };

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, "retrieval-quality.json"), `${JSON.stringify(result, null, 2)}\n`);

    const lines = [
        "# Retrieval Quality",
        "",
        `Model: \`${MODEL}\``,
        `Corpus: ${result.corpus.documents} documents, ${result.corpus.queries} labeled queries`,
        `Device: ${result.device}`,
        "Ranking: cosine similarity over normalized embeddings (equivalent to seekdb inner_product).",
        "",
        "| Run | Recall@5 | Recall@10 | nDCG@5 | nDCG@10 | MRR |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        `| FP32 | ${fp32.metrics.recall5} | ${fp32.metrics.recall10} | ${fp32.metrics.ndcg5} | ${fp32.metrics.ndcg10} | ${fp32.metrics.mrr} |`,
        `| INT8 | ${int8.metrics.recall5} | ${int8.metrics.recall10} | ${int8.metrics.ndcg5} | ${int8.metrics.ndcg10} | ${int8.metrics.mrr} |`,
        `| FP16 | ${"error" in fp16 ? "not supported by runner" : `${fp16.metrics.recall5} | ${fp16.metrics.recall10} | ${fp16.metrics.ndcg5} | ${fp16.metrics.ndcg10} | ${fp16.metrics.mrr}`} |`,
        "",
        "INT8 minus FP32:",
        `Recall@5 ${result.comparison.recall5_delta}, Recall@10 ${result.comparison.recall10_delta}, nDCG@5 ${result.comparison.ndcg5_delta}, nDCG@10 ${result.comparison.ndcg10_delta}, MRR ${result.comparison.mrr_delta}.`,
    ];
    await writeFile(join(OUT_DIR, "retrieval-quality.md"), `${lines.join("\n")}\n`);

    console.log(lines.join("\n"));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
