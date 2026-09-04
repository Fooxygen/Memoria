
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import type { Plugin, ViteDevServer } from "vite";
import type { ServerResponse, IncomingMessage } from "node:http";
import {
    db_client_get,
    db_close,
    documents_create,
    documents_add,
    documents_list,
    chunks_add,
} from "./db/db.ts";
import type { ChunkRecord } from "./db/meta.ts";

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

export function seekdb_plugin(): Plugin {
    return {
        name: "memoria-seekdb",
        async configureServer(server: ViteDevServer) {
            await db_client_get();
            await documents_create();

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

                if (path === "/api/ingest" && req.method === "POST") {
                    try {
                        const body = (await read_json(req)) as Record<string, unknown>;
                        const doc = body.doc as Record<string, unknown>;
                        const chunks = body.chunks as unknown[];

                        if (!doc) {
                            send_json(res, 400, { ok: false, error: "missing doc" });
                            return;
                        }

                        await documents_add({
                            id: String(doc.id),
                            title: String(doc.title ?? ""),
                            preview: String(doc.preview ?? ""),
                            chunk_count: Number(doc.chunk_count ?? 0),
                        });

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

                next();
            });

            server.httpServer?.once("close", () => {
                void db_close();
            });
        },
    };
}
