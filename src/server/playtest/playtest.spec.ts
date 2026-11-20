import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { checkExpect, allChecksPass, runScenario, quietConsole, type CheckResult } from "./core";
import { loadScenarios } from "./scenarios";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Golden suite: runs every scenario in scenarios/ that has an `expect` block,
 * then asserts it. No duplicate scenario definitions — the JSON is the source
 * of truth, consumed by both the CLI (for the agent) and this suite (for the
 * gate). Scenarios without `expect` run via the CLI but are not committed here.
 */
describe("playtest golden suite", () => {
    const scenarios = loadScenarios();

    // at least one regression-locked scenario must exist
    expect(scenarios.some((s) => s.expect), "expected at least one scenario with an `expect` block").toBe(true);

    for (const { name, file, input, expect: expectBlock, clock } of scenarios) {
        // only scenarios with an `expect` block are regression-locked
        if (!expectBlock) continue;

        test(`${name} (${file})`, () => {
            const result = quietConsole(() => runScenario(input as never, { name, clock }));
            const results = checkExpect(result, expectBlock);

            // every declared field must match
            const failed = results.filter((r) => !r.ok);
            expect(failed, `scenario ${name} failed:\n${formatChecks(results)}`).toHaveLength(0);
            expect(allChecksPass(results), `scenario ${name} failed`).toBe(true);
        });
    }
});

function formatChecks(results: CheckResult[]): string {
    return results
        .map((r) => `  ${r.ok ? "PASS" : "FAIL"}  ${r.field}: got ${JSON.stringify(r.actual)}, want ${JSON.stringify(r.expected)}`)
        .join("\n");
}
