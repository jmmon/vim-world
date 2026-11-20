# Playtest harness spec

## Goal

A headless harness so the agent can run the authoritative game engine without
the UI, to verify logic changes before the human does final validation.
Integration-style: drive the real engine, read the real output. Not unit tests.

The UI (canvas, client prediction, WebSocket transport) is a transport +
renderer on top of an authoritative engine. The engine is pure or stateful — no
DOM, no timers — so it can be driven directly.

## What is bypassed

- `src/fsm/fsm.ts` — browser-only (`window.setTimeout`, `reset`).
- `src/simulation/client/` — client prediction (`viewport`, `movement`,
  `interact`, `command`).
- `src/hooks/useWebSocket/` — browser WS client + reconciliation.
- `src/components/canvas1/` — canvas rendering.

## What is driven (the real engine, reused verbatim)

```
keystrokes → transitionTable → VimAction → expandAction →
serverValidators.basic → serverApplyAction (per tick) → state + reason
```

- `src/fsm/transtionTable.ts` — pure `transitionTable(mode, event, lastAction)`.
- `src/simulation/shared/loop/helpers.ts` — `expandAction`.
- `src/simulation/shared/loop/loop.ts` — `processPlayerTick`, `setupCallTicksForPlayer`.
- `src/simulation/server/validators` — seq + schema validation.
- `src/simulation/server/applyAction.ts` — `serverApplyAction: Record<VimActionType, fn>`.
- `src/server/serverState.ts` — `WORLD_WRAPPER`, `serverhandlers.addPlayer`.
- `src/simulation/shared/physics.ts` — `getServerPhysics()`.

Every function takes `ctx` as a param (`ServerWorldWrapper`), so a fresh world
is injected per scenario — no singleton mutation, no test isolation problems.

## Layout

```
src/server/playtest/
  core.ts        — pure harness: buildWorld, runScenario, drain,
                   compileKeystrokes, fakeEvent, checkExpect, allChecksPass,
                   diffTraceStep, quietConsole. No vitest, no CLI, no console.
                   Unit-testable, reusable.
  cli.ts         — CLI entry: arg parsing, trace printing. Thin presentation.
  index.ts       — re-exports for specs and CLI.
  scenarios/
    *.json       — declarative scenarios (source of truth).
  playtest.spec.ts — golden suite: loads scenarios, asserts.
```

Harness lives in `src/` so it is typechecked, built, linted, and formatted by
the gate. It must pass `pnpm lint`, `pnpm build.types`, `pnpm build`, and
`pnpm exec prettier --check src/server/playtest/**/*`.

## core.ts API

```ts
// build a fresh ServerWorldWrapper from the real intro map (seed 12345678,
// forest-v1). Spawn derives from the authored SPAWN entity. Injectable for
// targeted tests.
buildWorld(opts?: {
    name?: string;           // player name / spawn id (default: "playtest")
    spawn?: { x: number; y: number; dir: Player["dir"] }; // override spawn
    clock?: "fixed" | "real"; // tick timing mode (default: "fixed")
}): { world: ServerWorldWrapper; player: ServerPlayer }

// drive the full chain from keystrokes (and optional raw actions).
runScenario(input: ScenarioInput, opts?: BuildOptions & { ticksPerStep?: number }): PlayResult
// PlayResult = { world, player, trace: TraceStep[] }

// run the tick loop against a player's queue; undefined = accepted.
drain(world, player, { maxTicks?: number; clock }): string | undefined

// compile one keystroke group through the real FSM → VimAction.
compileKeystrokes(step: string[]): VimAction[]

// build a fake KeyboardEvent for the FSM transition table.
fakeEvent(key: string, mods?: { ctrlKey?; shiftKey?; altKey? }): FakeEvent

// compare the final trace entry against an `expect` block; field-scoped.
checkExpect(result: PlayResult, expect: Expect): CheckResult[]
allChecksPass(results: CheckResult[]): boolean

// changed fields between two trace entries (for the default trace view).
diffTraceStep(before: TraceStep, after: TraceStep): Partial<TraceStep>

// silence engine console noise for a run (restore after).
quietConsole<T>(fn: () => T): T
```

`runScenario` accepts an input array of either:

- **keystroke group** — a `string[]` like `["1","0","j"]`. Fed cumulatively
  through the real FSM, so one step = one command.
- **raw action** — a `VimAction` object (`{ type, key?, command?, count? }`).
  Bypasses the FSM; for applier-level tests or awkward cases.

Each step is enqueued, then the tick loop drains it at a fixed `ts`
(clock=fixed) or `Date.now()` (clock=real).

## trace

Full structured trace is the source. Two views:

- **default** — summary + deltas. Snapshot at start, then after each action only
  the *changed* fields print: `pos`, `dir`, `seq`, `reason`, changed entities,
  `itemIds`, `carryingObjId`, `commandLineState`.
- **`--json`** — full structured trace for tooling / future golden-trace diffing.
- **`--verbose`** — full raw table (opt-in when I need every field).

Trace fields to capture per scenario: `player.pos`, `player.dir`,
`lastProcessedSeq`, per-action `reason`, changed entities (doors opened / items
picked up), `itemIds`, `carryingObjId`, `commandLineState`.

## Determinism

- **RNG = production.** Intro map is seed-locked to `12345678` (`forest-v1`), so
  tiles and entities are identical every run. `getRandomHSLColor(playerId)` is
  per-id. Note the seed in every scenario. Keeps the real system.
- **Clock = fixed default / real opt-in.**
  - `--clock=fixed` (default): pass a fixed `ts` to ticks. Deterministic tick
    counts → reliable assertions. Collision/expansion/apply code runs
    identically; only timing is observable.
  - `--clock=real` (opt-in): real `Date.now()`, optionally with `VIMWORLD_LAG_MS`.
    Validates EMA catch-up, lag handling, the real 50ms loop. This is the
    "test the actual system" mode.

## CLI

```
tsx src/server/playtest/cli.ts <scenario.json> [flags]
tsx src/server/playtest/cli.ts --all [flags]
```

Flags: `--all` (run every scenario in `scenarios/`), `--clock=fixed|real`,
`--json`, `--verbose`, `--name=<id>`, `--ticks=N`.

`package.json` script: `"playtest": "tsx src/server/playtest/cli.ts"`.

## Scenario format

`scenarios/*.json` — declarative, source of truth. Consumed by both the CLI (for
me) and the golden suite (for the gate). Add one file; it is instantly runnable
and instantly tested.

```json
{
  "name": "yank key from chest",
  "input": [["w"], ["l", "l", "l", "l", "l", "l"], ["k"], ["j"], ["y", "i", "\""]],
  "expect": {
    "pos": { "x": 12, "y": 7 },
    "dir": "S",
    "itemIds": ["KEY-8BB6yFGjn9V"],
    "entities": { "DOOR-1": { "collision.solid": false, "state.open": true } }
  }
}
```

- `expect` is field-scoped, never a full-object snapshot (`testing.md`).
- `expect.pos` / `dir` / `seq` / `itemIds` / `carryingObjId` / `commandLineState`
  assert on the player. `expect.entities` asserts on world entities by id and
  dotted field path (e.g. `DOOR-1.state.open`), for the door-opening signal.
- Scenarios with `expect` are committed to the golden suite.
- Exploratory scenarios (no `expect`) run via CLI but are not committed to the
  suite — the gate only locks behaviors decided as regression-worthy.
- **After any map change, re-derive the affected `expect` blocks from real
  engine output, don't hand-type them.** Run
  `pnpm playtest src/server/playtest/scenarios/<file>.json --verbose`, read the
  actual final `pos`/`dir`/`items`/entity states, then edit that scenario's
  `expect` JSON to match. Pure-FSM scenarios (`command-line`) have no map
  dependency and never need updating.

## Golden suite

`src/server/playtest/playtest.spec.ts` — loads every scenario in
`scenarios/` that has an `expect`, runs `runScenario`, checks with
`checkExpect`, asserts. Runs in `pnpm test.unit`. No duplicate scenario
definitions; it iterates the JSON. Engine console noise is silenced with
`quietConsole` so the suite stays quiet.

## Scope

Covered: movement, interact (yank/paste/drop/cut), command line.
Excluded: `TARGET` — `applyTargetToServerWorld` is unimplemented (logs
`"NOT yet implemented"`, returns `INVALID_ACTION`). Revisit after it is built.

## Noise

`basic.ts` (`validateActionSequence`, `validateActionSchema`) and `command.ts`
(`handleKey`) log a lot. Silenced during runs with `quietConsole`, so both the
CLI and the golden suite stay quiet.

## Future growth

| Future need | Where it goes |
|---|---|
| More scenarios | add `scenarios/*.json` |
| Multi-player testing | `buildWorld({ spawn: [...] })` + multi-step `runScenario` in `core.ts` |
| Real WebSocket / lag integration | separate module reusing `buildServerWorld`; not in golden suite (slower) |
| E2E via browser | complements `@playwright/test` (already a dep); fast logic vs slow UI |
| Golden-trace regression | thin layer over the structured trace, opt-in |

## Open items to verify at build

- `tsx` resolves `~/` via tsconfig paths at runtime (verified working).
- `tsx` added to `devDependencies`.
