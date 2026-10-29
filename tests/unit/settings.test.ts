// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { describe, expect, it } from "vitest";
import {
    INFER_MODEL_DIM,
    SEARCH_MODE_OPTIONS,
    SEARCH_SETTING_DEFAULT,
} from "../../src/store/settings";

describe("search settings", () => {
    it("keeps the default top_k inside its bounds", () => {
        expect(SEARCH_SETTING_DEFAULT.top_k).toBeGreaterThanOrEqual(SEARCH_SETTING_DEFAULT.top_k_min);
        expect(SEARCH_SETTING_DEFAULT.top_k).toBeLessThanOrEqual(SEARCH_SETTING_DEFAULT.top_k_max);
    });

    it("offers both hybrid and semantic modes", () => {
        expect(SEARCH_MODE_OPTIONS.map((option) => option.value)).toEqual(["hybrid", "semantic"]);
    });
});

describe("inference settings", () => {
    it("uses the 384-dimension MiniLM embedding", () => {
        expect(INFER_MODEL_DIM).toBe(384);
    });
});
