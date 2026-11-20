import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Expect } from "./core";

/**
 * Load every scenario JSON next to this file (scenarios/). Shared by the CLI
 * and the golden suite so there is one source of truth.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

export type { Expect };

export type Scenario = {
    name: string;
    file: string;
    input: unknown[];
    expect?: Expect;
    clock?: "fixed" | "real";
    ticks?: number;
};

export function loadScenarios(): Scenario[] {
    const dir = join(__dirname, "scenarios");
    return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
            const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
            return {
                name: data.name ?? f,
                file: f,
                input: data.input ?? [],
                expect: data.expect,
                clock: data.clock,
                ticks: data.ticks,
            };
        });
}
