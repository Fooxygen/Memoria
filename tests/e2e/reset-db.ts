// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

await rm(resolve("data/e2e-test"), { recursive: true, force: true });
