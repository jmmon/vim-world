/**
 * Playtest CLI.
 *
 *   tsx src/server/playtest/cli.ts <scenario.json> [flags]
 *   tsx src/server/playtest/cli.ts --all [flags]
 *
 * Flags:
 *   --all              run every committed scenario in scenarios/
 *   --clock=fixed|real tick timing (default: fixed)
 *   --json             print the full structured trace as JSON
 *   --verbose          print the full trace table (not just deltas)
 *   --name=<id>        player name / spawn id (default: playtest)
 *   --ticks=N          ticks to run per step (default: drain the queue)
 *
 * A scenario with an `expect` block is checked against the final trace entry
 * and reported PASS/FAIL. Scenarios without `expect` just run and print a trace.
 */
import { readFileSync } from "node:fs";
import {
    checkExpect,
    allChecksPass,
    diffTraceStep,
    runScenario,
    type CheckResult,
    type Expect,
    type TraceStep,
    quietConsole,
} from "./core";
import { loadScenarios, type Scenario } from "./scenarios";

type Flags = {
    all: boolean;
    clock?: "fixed" | "real";
    json: boolean;
    verbose: boolean;
    name?: string;
    ticks?: number;
};

function parseArgs(argv: string[]): { files: string[]; flags: Flags } {
    const files: string[] = [];
    const flags: Flags = { all: false, json: false, verbose: false };
    for (const arg of argv) {
        if (arg.startsWith("--")) {
            const [key, value] = arg.slice(2).split("=");
            switch (key) {
                case "all":
                    flags.all = true;
                    break;
                case "clock":
                    flags.clock = value as "fixed" | "real";
                    break;
                case "json":
                    flags.json = true;
                    break;
                case "verbose":
                    flags.verbose = true;
                    break;
                case "name":
                    flags.name = value;
                    break;
                case "ticks":
                    flags.ticks = Number(value);
                    break;
                default:
                    console.error(`unknown flag: --${key}`);
            }
        } else {
            files.push(arg);
        }
    }
    return { files, flags };
}

function formatCheck(results: CheckResult[]): string {
    return results
        .map((r) => {
            const status = r.ok ? "PASS" : "FAIL";
            return `  ${status}  ${r.field}: got ${JSON.stringify(r.actual)}, want ${JSON.stringify(r.expected)}`;
        })
        .join("\n");
}

function formatTable(trace: TraceStep[]): string {
    const header = ["step", "action", "reason", "pos", "dir", "seq", "items", "carried", "cmd"];
    const rows = trace.map((t) => [
        String(t.step),
        t.action ? JSON.stringify(t.action) : "",
        t.reason ?? "",
        `${t.pos.x},${t.pos.y}`,
        t.dir,
        String(t.seq),
        t.itemIds.length ? t.itemIds.join(",") : "",
        t.carryingObjId ?? "",
        t.commandLineState,
    ]);
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
    const fmtRow = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(" | ");
    return [fmtRow(header), ...rows.map(fmtRow)].join("\n");
}

function printTrace(trace: TraceStep[], flags: Flags): void {
    if (flags.json) {
        console.log(JSON.stringify(trace, null, 2));
        return;
    }

    if (flags.verbose) {
        console.log(formatTable(trace));
        return;
    }

    // default: summary + deltas (only changed fields per step)
    for (let i = 1; i < trace.length; i++) {
        const before = trace[i - 1];
        const after = trace[i];
        const changes = diffTraceStep(before, after);
        const fields = Object.keys(changes);
        const detail = fields.length
            ? `  { ${fields.map((f) => `${f}: ${JSON.stringify((changes as Record<string, unknown>)[f])}`).join(", ")} }`
            : "  (no change)";
        const action = after.action ? ` ${JSON.stringify(after.action)}` : "";
        console.log(`step ${after.step}${action}:${detail}`);
    }
}

function runOne(scenario: Scenario, flags: Flags): boolean {
    const result = quietConsole(() =>
        runScenario(scenario.input as never, {
            clock: flags.clock ?? scenario.clock,
            name: scenario.name,
            ticksPerStep: flags.ticks,
        }),
    );

    printTrace(result.trace, flags);

    if (scenario.expect) {
        const results = checkExpect(result, scenario.expect);
        const allPass = allChecksPass(results);
        console.log(`\n${scenario.name}: ${allPass ? "PASS" : "FAIL"}`);
        console.log(formatCheck(results));
        return allPass;
    }
    return true;
}

function main(): void {
    const { files, flags } = parseArgs(process.argv.slice(2));

    const scenarios: Scenario[] = flags.all
        ? loadScenarios()
        : files.length
            ? files.map((f) => {
                  const data = JSON.parse(readFileSync(f, "utf8"));
                  return { name: f, file: f, input: data.input ?? [], expect: undefined };
              })
            : [];
    if (!scenarios.length) {
        console.error("usage: tsx src/server/playtest/cli.ts <scenario.json|--all> [--clock=fixed|real] [--json] [--verbose] [--name=id] [--ticks=N]");
        process.exit(1);
    }

    let pass = true;
    for (const scenario of scenarios) {
        pass = runOne(scenario, flags) && pass;
    }

    if (!pass) process.exit(1);
}

main();
