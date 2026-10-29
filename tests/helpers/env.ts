// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface TestEnv {
    root:       string;
    db:         string;
    models:     string;
    model_file: string;
}

export async function test_env_create(): Promise<TestEnv> {
    const root = await mkdtemp(join(tmpdir(), "memoria-test-"));
    const db = join(root, "db");
    const models = join(root, "models");
    const model_file = join(models, "Xenova", "all-MiniLM-L6-v2", "onnx", "model_quantized.onnx");

    await mkdir(dirname(model_file), { recursive: true });
    await writeFile(model_file, Buffer.from("model"));

    process.env.MEMORIA_DB_PATH = db;
    process.env.MEMORIA_MODEL_ROOT = models;

    return { root, db, models, model_file };
}

export async function test_env_remove(env: TestEnv): Promise<void> {
    try {
        await rm(env.root, { recursive: true, force: true });
    } catch (error) {
        // seekdb 关闭后仍可能短暂持有 log/sstable 文件句柄；临时目录可以留给系统清理。
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES" && code !== "ENOTEMPTY") throw error;
        console.warn(`[test] 临时目录仍被 seekdb 占用，跳过清理：${env.root}`);
    }
}
