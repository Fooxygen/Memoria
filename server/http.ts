
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { Plugin, ViteDevServer } from "vite";
import type { ServerResponse, IncomingMessage } from "node:http";
import { createReadStream } from "node:fs";
import { existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import {
    db_client_get,
    db_close,
    documents_create,
    documents_add,
    documents_delete,
    documents_list,
    document_contents_create,
    document_contents_add,
    document_contents_delete,
    document_content_get,
    document_find_by_hash,
    chunks_add,
    chunks_delete_by_document,
    chunks_refresh_if_dirty,
    chunks_search,
    chunks_hybrid_search,
} from "./db/db.ts";
import type { ChunkRecord } from "./db/meta.ts";

const MODELS_ROOT = resolve(process.cwd(), "data", "models");

const MIME_BY_EXT: Record<string, string> = {
    ".onnx": "application/octet-stream",
    ".json": "application/json",
    ".txt":  "text/plain",
    ".map":  "application/json",
};

function serve_models(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const path = new URL(req.url ?? "", "http://localhost").pathname;
    if (!path.startsWith("/models/")) {
        next();
        return;
    }
    const rel = decodeURIComponent(path.slice("/models/".length)).replace(/\\/g, "/");
    const file = normalize(join(MODELS_ROOT, rel));
    if (!file.startsWith(MODELS_ROOT)) {
        res.statusCode = 403;
        res.end();
        return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
        res.statusCode = 404;
        res.end();
        return;
    }
    const type = MIME_BY_EXT[file.slice(file.lastIndexOf(".")).toLowerCase()] ?? "application/octet-stream";
    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    if (req.method === "HEAD") {
        res.setHeader("Content-Length", statSync(file).size);
        res.end();
        return;
    }
    createReadStream(file).pipe(res);
}

function read_json(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
        });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on("error", reject);
    });
}

function send_json(res: ServerResponse, status: number, data: unknown): void {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
}

// RRF 融合分不具备统一相似度语义：混合检索的匹配度按命中名次相对映射（0-100）。
function hybrid_pct(index: number, total: number): number {
    if (total <= 1) return 100;
    return Math.max(5, Math.round(100 - (index / (total - 1)) * 95));
}

export function seekdb_plugin(): Plugin {
    return {
        name: "memoria-seekdb",
        async configureServer(server: ViteDevServer) {
            await db_client_get();
            await documents_create();
            await document_contents_create();

            server.middlewares.use(serve_models);

            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url ?? "", "http://localhost");
                const path = url.pathname;

                if (path === "/api/health" && req.method === "GET") {
                    send_json(res, 200, { ok: true });
                    return;
                }

                if (path === "/api/documents" && req.method === "GET") {
                    const documents = await documents_list();
                    send_json(res, 200, { documents });
                    return;
                }

                if (path === "/api/document/content" && req.method === "GET") {
                    try {
                        const id = String(url.searchParams.get("id") ?? "");
                        if (!id) {
                            send_json(res, 400, { ok: false, error: "missing id" });
                            return;
                        }
                        const content = await document_content_get(id);
                        if (content === null) {
                            send_json(res, 404, { ok: false, error: "not found" });
                            return;
                        }
                        send_json(res, 200, { id, content });
                    } catch (error) {
                        console.error("[content] error:", error);
                        send_json(res, 500, { ok: false, error: String(error) });
                    }
                    return;
                }

                if (path === "/api/document" && req.method === "DELETE") {
                    try {
                        const id = String(url.searchParams.get("id") ?? "");
                        if (!id) {
                            send_json(res, 400, { ok: false, error: "missing id" });
                            return;
                        }
                        await chunks_delete_by_document(id);
                        await documents_delete(id);
                        await document_contents_delete(id);
                        send_json(res, 200, { ok: true });
                    } catch (error) {
                        console.error("[delete] error:", error);
                        send_json(res, 500, { ok: false, error: String(error) });
                    }
                    return;
                }

                if (path === "/api/search" && req.method === "POST") {
                    try {
                        const body = (await read_json(req)) as { vec?: number[]; top_k?: number; mode?: string; query?: string };
                        const vec = body.vec ?? [];
                        if (!vec.length) {
                            send_json(res, 400, { ok: false, error: "missing vec" });
                            return;
                        }
                        const limit = Number(body.top_k) || 5;
                        const mode = body.mode === "hybrid" && typeof body.query === "string" && body.query.trim()
                            ? "hybrid"
                            : "semantic";
                        const raw = (mode === "hybrid"
                            ? await chunks_hybrid_search(body.query as string, vec, limit)
                            : await chunks_search(vec, limit)) as {
                                documents?: (string | null)[] | (string | null)[][];
                                distances?: number[] | number[][];
                            };
                        const docs = raw.documents as (string | null)[] | undefined;
                        const dists = raw.distances as number[] | undefined;
                        const row_docs = Array.isArray(docs) && Array.isArray(docs[0]) ? (docs[0] as (string | null)[]) : (docs ?? []);
                        const row_dists = Array.isArray(dists) && Array.isArray(dists[0]) ? (dists[0] as number[]) : (dists ?? []);
                        const hits = row_docs.map((content, i) => {
                            const d = row_dists[i];
                            const pct = mode === "hybrid" || d == null || !Number.isFinite(d)
                                ? hybrid_pct(i, row_docs.length)
                                : Math.min(99, Math.max(1, Math.round(((d + 1) / 2) * 100)));
                            return { content: String(content ?? ""), pct };
                        });
                        send_json(res, 200, { hits });
                    } catch (error) {
                        console.error("[search] error:", error);
                        send_json(res, 500, { ok: false, error: String(error) });
                    }
                    return;
                }

                if (path === "/api/ingest" && req.method === "POST") {
                    try {
                        const body = (await read_json(req)) as Record<string, unknown>;
                        const doc = body.doc as Record<string, unknown>;
                        const chunks = body.chunks as unknown[];

                        if (!doc) {
                            send_json(res, 400, { ok: false, error: "missing doc" });
                            return;
                        }

                        const content_hash = typeof doc.content_hash === "string" ? doc.content_hash : "";

                        if (content_hash) {
                            const existing = await document_find_by_hash(content_hash);
                            if (existing) {
                                send_json(res, 200, { ok: false, duplicate: true, title: existing.title });
                                return;
                            }
                        }

                        await documents_add({
                            id: String(doc.id),
                            title: String(doc.title ?? ""),
                            preview: String(doc.preview ?? ""),
                            chunk_count: Number(doc.chunk_count ?? 0),
                            content_hash: content_hash || undefined,
                        });

                        if (typeof doc.content === "string") {
                            await document_contents_add(String(doc.id), doc.content);
                        }

                        if (chunks?.length) {
                            const records: ChunkRecord[] = chunks.map((c) => {
                                const record = c as Record<string, unknown>;
                                return {
                                    id: String(record.id),
                                    content: String(record.content ?? ""),
                                    embedding: (record.embedding as number[]) ?? [],
                                    meta: (record.meta as ChunkRecord["meta"]) ?? {},
                                };
                            });
                            await chunks_add(records);
                        }

                        send_json(res, 200, { ok: true });
                    } catch (error) {
                        send_json(res, 500, { ok: false, error: String(error) });
                    }
                    return;
                }

                if (path === "/api/index/flush" && req.method === "POST") {
                    try {
                        await read_json(req);
                        const refreshed = await chunks_refresh_if_dirty();
                        send_json(res, 200, { ok: true, refreshed });
                    } catch (error) {
                        console.error("[flush] error:", error);
                        send_json(res, 500, { ok: false, error: String(error) });
                    }
                    return;
                }

                next();
            });

            server.httpServer?.once("close", () => {
                void db_close();
            });
        },
    };
}
