// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { api_middleware, serve_models } from "../../server/http.ts";
import { db_close } from "../../server/db/db.ts";

export interface TestApi {
    url:   string;
    close: () => Promise<void>;
}

function send_error(res: ServerResponse, error: unknown): void {
    if (res.headersSent) {
        res.destroy();
        return;
    }
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: String(error) }));
}

export async function test_api_start(): Promise<TestApi> {
    const server = createServer((req, res) => {
        try {
            serve_models(req, res, () => {
                void api_middleware(req, res, () => {
                    res.statusCode = 404;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: false, error: "not found" }));
                }).catch((error) => send_error(res, error));
            });
        } catch (error) {
            send_error(res, error);
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${address.port}`,
        async close() {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
            await db_close();
        },
    };
}
