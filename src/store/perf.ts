// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

export function perf_start(name: string): void {
    performance.mark(`${name}:start`);
}

export function perf_end(name: string): void {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
}
