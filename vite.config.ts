
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { defineConfig } from "vite";
import { seekdb_plugin } from "./server/http.ts";

export default defineConfig({
    plugins: [seekdb_plugin()],
});
