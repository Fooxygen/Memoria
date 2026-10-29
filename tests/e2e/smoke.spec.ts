// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { test, expect } from "@playwright/test";

test("loads the app and health endpoint", async ({ page, request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toEqual({ ok: true });

    await page.goto("/");
    await expect(page.locator("#rt_model")).toHaveText("all-MiniLM-L6-v2");
    await expect(page.getByText("字里行间，")).toBeVisible();
});
