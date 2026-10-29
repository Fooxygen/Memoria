// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/integration/**/*.test.ts"],
        environment: "node",
        pool: "forks",
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // seekdb 原生 addon 在 worker 退出时会向已关闭的 stdio 写日志；测试断言本身不受影响。
        onUnhandledError(error) {
            if ((error as NodeJS.ErrnoException).code === "EBADF") return false;
        },
    },
});
