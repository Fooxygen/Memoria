// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { defineConfig, devices } from "@playwright/test";

const channel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";

export default defineConfig({
    testDir: "./tests/bench",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: "list",
    timeout: 180_000,
    use: {
        baseURL: "http://127.0.0.1:4174",
        trace: "off",
    },
    projects: [
        {
            name: "edge",
            use: {
                ...devices["Desktop Edge"],
                channel,
            },
        },
    ],
    webServer: {
        command: "npx tsx tests/e2e/reset-db.ts && npx vite --host 127.0.0.1 --port 4174",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            MEMORIA_DB_PATH: "./data/e2e-test",
            MEMORIA_MODEL_ROOT: "./data/models",
        },
    },
});
