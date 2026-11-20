/**
 * Headless playtest harness.
 *
 * Drives the authoritative game engine without the UI so the agent can verify
 * logic changes before the human does final validation. Integration-style: the
 * real engine runs, the real output is read. Not unit tests.
 *
 * The UI (canvas, client prediction, WebSocket transport) is a transport +
 * renderer on top of an authoritative engine. The engine is pure or stateful —
 * no DOM, no timers — so it can be driven directly.
 *
 * Bypassed:
 *   - src/fsm/fsm.ts         (browser-only: window.setTimeout, reset)
 *   - src/simulation/client/ (client prediction: viewport, movement, interact, command)
 *   - src/hooks/useWebSocket/ (browser WS client + reconciliation)
 *   - src/components/canvas1/ (canvas rendering)
 *
 * Driven (the real engine, reused verbatim):
 *   keystrokes → transitionTable → VimAction → expandAction →
 *   serverValidators.basic → serverApplyAction (per tick) → state + reason
 *
 * Every engine function takes ctx as a param (ServerWorldWrapper), so a fresh
 * world is injected per scenario — no singleton mutation, no isolation issues.
 */
import { transitionTable } from "~/fsm/transtionTable";
import { ExpandedVimAction, VimAction, VimFSMState } from "~/fsm/types";
import { expandAction } from "~/simulation/shared/loop/helpers";
import { MOVEMENT_CONFIG, setupCallTicksForPlayer } from "~/simulation/shared/loop/loop";
import { getServerPhysics } from "~/simulation/shared/physics";
import { ActionResult } from "~/simulation/types";
import { ReasonRejected } from "~/simulation/server/types";
import serverValidators from "~/simulation/server/validators";
import { serverApplyAction } from "~/simulation/server/applyAction";
import { ServerWorldWrapper } from "~/server/types";
import { ServerPlayer, Player, WorldEntity } from "~/types/worldTypes";
import { Zone, isHandAuthoredZone } from "~/server/map";
import { entities as realEntities } from "~/server/objects";
import { MAP_CONFIG } from "~/server/map";
import { WORLD_WRAPPER, serverhandlers } from "~/server/serverState";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type Clock = "fixed" | "real";

export type FakeEvent = {
    key: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    preventDefault(): void;
};

/**
 * An input step. Keystroke group = a `string[]` of keystrokes forming one
 * command, fed cumulatively through the real FSM. Raw action = a `VimAction`
 * that bypasses the FSM, for applier-level tests or awkward cases.
 */
export type InputStep = string[] | VimAction;

export type ScenarioInput = InputStep[];

export type PlayResult = {
    world: ServerWorldWrapper;
    player: ServerPlayer;
    /** one entry per input step: the state and reason after that step ran. */
    trace: TraceStep[];
};

export type TraceStep = {
    step: number;
    kind: "keystroke" | "action";
    /** the compiled VimAction (keystroke steps show the FSM output). */
    action?: VimAction;
    /** the reason returned by the engine for this step (undefined = accepted). */
    reason?: string;
    pos: { x: number; y: number };
    dir: Player["dir"];
    seq: number;
    itemIds: string[];
    carryingObjId?: string;
    commandLineState: string;
    /** entities changed by this step (doors opened, items moved). */
    changedEntities: string[];
};

// ---------------------------------------------------------------------------
// fakeEvent — build a KeyboardEvent-shaped object for the FSM transition table
// ---------------------------------------------------------------------------

export function fakeEvent(
    key: string,
    mods: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
): FakeEvent {
    return {
        key,
        ctrlKey: mods.ctrlKey ?? false,
        shiftKey: mods.shiftKey ?? false,
        altKey: mods.altKey ?? false,
        preventDefault() {},
    };
}

// ---------------------------------------------------------------------------
// compile — keystrokes through the real FSM transition table
// ---------------------------------------------------------------------------

/**
 * Run a group of keystrokes through the real FSM transition table and return
 * the emitted VimActions. Stateful: the FSM state persists across calls, so a
 * command spanning multiple keystrokes (e.g. `:wq`) compiles correctly.
 *
 * Mirrors how the browser FSM compiles keys, minus the browser-only
 * window.setTimeout reset (replaced with an explicit reset on `__reset__`).
 */
export function compileKeystrokes(
    keystrokes: string[],
    mods?: Record<string, { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }>,
): VimAction[] {
    const state: VimFSMState = { mode: "normal", buffer: [], count: null };
    const lastAction: { current: VimAction | null } = { current: null };
    const emitted: VimAction[] = [];

    for (const key of keystrokes) {
        const event = fakeEvent(key, mods?.[key]);
        const result = transitionTable[state.mode](state, event as never, lastAction.current);

        if (result.state === "__reset__") {
            // reset to the normal-mode initial state (see STATE_INITIAL in fsm.ts)
            Object.assign(state, { mode: "normal", buffer: [], count: null });
            delete state.operator;
            delete state.motion;
        } else {
            // shallow-merge the produced state onto the current one
            Object.assign(state, result.state);
        }

        if (result.emit) {
            lastAction.current = result.emit;
            emitted.push(result.emit);
        }
    }

    return emitted;
}

// ---------------------------------------------------------------------------
// build — construct a fresh ServerWorldWrapper for a scenario
// ---------------------------------------------------------------------------

export type BuildOptions = {
    /** override the zone (default: real intro map, seed 12345678). */
    zone?: Zone;
    /** override spawn name/id (default: "playtest"). */
    name?: string;
    /** override spawn position/dir (default: the zone SPAWN entity). */
    spawn?: { x: number; y: number; dir?: Player["dir"] };
    /** tick timing mode (default: "fixed"). */
    clock?: Clock;
};

/**
 * Build a fresh ServerWorldWrapper from the real intro map (seed 12345678,
 * forest-v1) by default. Injectable for targeted tests. The player is added to
 * the world so the tick loop and collision see it.
 *
 * The real `entities` map is a cached singleton that the engine mutates during
 * play (doors open, items picked up). We clone it into a fresh map so each
 * scenario is isolated — no state leaks between runs.
 */
export function buildWorld(options: BuildOptions = {}): {
    world: ServerWorldWrapper;
    player: ServerPlayer;
} {
    const zone = options.zone ?? (WORLD_WRAPPER.world.zone as Zone);

    const world: ServerWorldWrapper = {
        world: {
            zone,
            players: new Map(),
            // clone the real entities so scenario mutation stays isolated
            entities: new Map(
                Array.from(realEntities.entries()).map(([id, e]) => [
                    id,
                    JSON.parse(JSON.stringify(e)) as WorldEntity,
                ]),
            ),
            config: MAP_CONFIG,
        },
        physics: getServerPhysics(),
    };

    const name = options.name ?? "playtest";
    // derive spawn from the authored SPAWN entity (the single source of truth),
    // falling back to the designed center if absent.
    const spawnEntity = isHandAuthoredZone(zone)
        ? zone.entities?.find((e) => e.type === "SPAWN")
        : undefined;
    const spawn = options.spawn ?? {
        x: spawnEntity?.x ?? 4,
        y: spawnEntity?.y ?? 7,
        dir: (spawnEntity?.dir as Player["dir"]) ?? "E",
    };
    const player: Player = {
        name,
        id: name,
        pos: { x: spawn.x, y: spawn.y },
        dir: spawn.dir ?? "E",
        color: "#ff00ff",
        zone: "default",
        lastProcessedSeq: -1,
        level: 1,
        session: {
            xpGained: 0,
            goldGained: 0,
            itemsAdded: [],
            itemsRemoved: [],
            achievementsUnlocked: [],
        },
    };

    const added = serverhandlers.addPlayer(world, player);
    if (!added) throw new Error("addPlayer failed");

    const serverPlayer = serverhandlers.getPlayerById(world, name) as ServerPlayer;
    return { world, player: serverPlayer };
}

// ---------------------------------------------------------------------------
// runScenario — drive a full scenario through the engine
// ---------------------------------------------------------------------------

/**
 * Drive a scenario through the real engine. Each input step is compiled (if a
 * keystroke group) → expanded → enqueued, then the tick loop drains it.
 *
 * A keystroke group is a `string[]` — the keystrokes of one command, fed
 * cumulatively through the real FSM (so `:`, `w`, `q`, `<CR>` compile to a
 * command line). A raw `VimAction` bypasses the FSM.
 *
 * clock=fixed passes a fixed `ts` to ticks (deterministic tick counts).
 * clock=real uses Date.now() (validates the real 50ms loop / EMA catch-up).
 */
export function runScenario(
    input: ScenarioInput,
    options: BuildOptions & {
        /** how many ticks to run after each step (default: drain the queue). */
        ticksPerStep?: number;
    } = {},
): PlayResult {
    const clock = options.clock ?? "fixed";
    const ticksPerStep = options.ticksPerStep ?? Infinity;
    const { world, player } = buildWorld(options);

    // capture the initial state as the first trace entry
    const initial = snapshot(world, player);
    const trace: TraceStep[] = [{ ...initial, step: 0, kind: "keystroke" as const, reason: undefined }];

    // the FSM persists across the whole scenario, like the live game
    const state: VimFSMState = { mode: "normal", buffer: [], count: null };
    const lastAction: { current: VimAction | null } = { current: null };
    let stepIndex = 0;

    const feed = (keys: string[]): VimAction[] => {
        const emitted: VimAction[] = [];
        for (const key of keys) {
            const event = fakeEvent(key);
            const result = transitionTable[state.mode](state, event as never, lastAction.current);

            if (result.state === "__reset__") {
                Object.assign(state, { mode: "normal", buffer: [], count: null });
                delete state.operator;
                delete state.motion;
            } else {
                Object.assign(state, result.state);
            }

            if (result.emit) {
                lastAction.current = result.emit;
                emitted.push(result.emit);
            }
        }
        return emitted;
    };

    const runStep = (step: InputStep) => {
        stepIndex++;

        let actions: VimAction[];
        let kind: "keystroke" | "action";
        if (Array.isArray(step)) {
            kind = "keystroke";
            actions = feed(step);
        } else {
            kind = "action";
            actions = [step];
        }

        // expand + enqueue each compiled action
        for (const action of actions) {
            const seq = (player.lastProcessedSeq ?? -1) + 1;
            const expanded: ExpandedVimAction[] = expandAction(
                { seq, action, clientTime: Date.now() },
                player.lastProcessedSeq ?? -1,
            );
            player.actionQueue.push(...expanded);
        }

        // drain the queue for this step
        const reason = drain(world, player, { maxTicks: ticksPerStep, clock });
        trace.push({
            ...snapshot(world, player),
            step: stepIndex,
            kind,
            action: actions[0],
            reason,
        });
    };

    for (const step of input) runStep(step);

    return { world, player, trace };
}

/**
 * Run the tick loop against a player's queue. Returns the last reason the engine
 * produced (undefined = accepted).
 *
 * Uses the real `setupCallTicksForPlayer`. clock=fixed advances a virtual clock
 * by one tick per call (deterministic tick counts, ideal for assertions).
 * clock=real uses Date.now() (validates the EMA catch-up / real loop shape).
 */
export function drain(
    world: ServerWorldWrapper,
    player: ServerPlayer,
    options: { maxTicks?: number; clock?: Clock } = {},
): string | undefined {
    const clock = options.clock ?? "fixed";
    const maxTicks = options.maxTicks ?? Infinity;
    let lastReason: ActionResult['reason'] | ReasonRejected | undefined;
    let lastTs = 0;

    const callTicks = setupCallTicksForPlayer(
        world,
        player,
        (_ctx, action) => {
            lastReason = serverApplyAction[action.type](world, player, action);
            return lastReason;
        },
    );

    for (let t = 0; t < maxTicks; t++) {
        const ts = clock === "real"
            ? Math.max(Date.now(), lastTs + 1)
            : t * MOVEMENT_CONFIG.tickMs;
        lastTs = ts;
        callTicks(ts, t);

        // stop once the queue is empty
        if (player.actionQueue.length === 0) break;
    }

    return lastReason;
}

// ---------------------------------------------------------------------------
// snapshot — capture the observable state for a trace entry
// ---------------------------------------------------------------------------

function snapshot(world: ServerWorldWrapper, player: ServerPlayer): Omit<TraceStep, "step" | "kind" | "reason" | "action"> {
    const changed = player.pendingWorldStateEntities ?? [];
    return {
        pos: { x: player.pos.x, y: player.pos.y },
        dir: player.dir,
        seq: player.lastProcessedSeq ?? -1,
        itemIds: [...(player.itemIds ?? [])],
        carryingObjId: player.carryingObjId,
        commandLineState: player.commandLineState?.buffer ?? "",
        changedEntities: changed.map((e: WorldEntity) => e.id),
    };
}

/** extract just the changed fields between two trace entries (for the default trace view). */
export function diffTraceStep(before: TraceStep, after: TraceStep): Partial<TraceStep> {
    const changes: Partial<TraceStep> = {};
    const fields: (keyof TraceStep)[] = [
        "pos",
        "dir",
        "seq",
        "itemIds",
        "carryingObjId",
        "commandLineState",
        "changedEntities",
    ];
    for (const field of fields) {
        if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
            (changes as Record<string, unknown>)[field] = (after as Record<string, unknown>)[field];
        }
    }
    if (after.reason !== before.reason) {
        changes.reason = after.reason;
    }
    return changes;
}

// ---------------------------------------------------------------------------
// checkExpect — assert on the final trace entry (shared by CLI and golden suite)
// ---------------------------------------------------------------------------

export type Expect = Partial<{
    pos: { x?: number; y?: number };
    dir: Player["dir"];
    seq: number;
    itemIds?: string[];
    carryingObjId?: string;
    commandLineState?: string;
    /**
     * assert on world entities by id and dotted field path, e.g.
     * { "DOOR-1": { "state.open": true, "collision.solid": false } }.
     * Field-scoped (one field on one entity), never a full entity snapshot.
     */
    entities?: Record<string, Record<string, unknown>>;
}>;

export type CheckResult = {
    field: string;
    expected: unknown;
    actual: unknown;
    ok: boolean;
};

/**
 * Compare the final trace entry against an `expect` block. Field-scoped, never
 * a full-object snapshot (per docs/agents/testing.md).
 */
export function checkExpect(result: PlayResult, expect: Expect): CheckResult[] {
    const last = result.trace[result.trace.length - 1];
    const results: CheckResult[] = [];

    if (expect.pos) {
        for (const [key, value] of Object.entries(expect.pos)) {
            results.push({
                field: `pos.${key}`,
                expected: value,
                actual: (last.pos as Record<string, unknown>)[key],
                ok: (last.pos as Record<string, unknown>)[key] === value,
            });
        }
    }
    if (expect.dir !== undefined) {
        results.push({ field: "dir", expected: expect.dir, actual: last.dir, ok: last.dir === expect.dir });
    }
    if (expect.seq !== undefined) {
        results.push({ field: "seq", expected: expect.seq, actual: last.seq, ok: last.seq === expect.seq });
    }
    if (expect.itemIds !== undefined) {
        results.push({
            field: "itemIds",
            expected: expect.itemIds,
            actual: last.itemIds,
            ok: JSON.stringify(expect.itemIds) === JSON.stringify(last.itemIds),
        });
    }
    if (expect.carryingObjId !== undefined) {
        results.push({ field: "carryingObjId", expected: expect.carryingObjId, actual: last.carryingObjId, ok: last.carryingObjId === expect.carryingObjId });
    }
    if (expect.commandLineState !== undefined) {
        results.push({ field: "commandLineState", expected: expect.commandLineState, actual: last.commandLineState, ok: last.commandLineState === expect.commandLineState });
    }
    if (expect.entities) {
        for (const [entityId, paths] of Object.entries(expect.entities)) {
            const entity = Array.from(result.world.world.entities.values()).find((e: WorldEntity) => e.id === entityId);
            for (const [path, expectedValue] of Object.entries(paths)) {
                const actual = getDotPath(entity, path);
                results.push({ field: `entity.${entityId}.${path}`, expected: expectedValue, actual, ok: JSON.stringify(actual) === JSON.stringify(expectedValue) });
            }
        }
    }

    return results;
}

/** read a dotted path (e.g. "state.open") from a nested value. */
function getDotPath(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

/** true if every check passed (used by the CLI and golden suite). */
export function allChecksPass(results: CheckResult[]): boolean {
    return results.every((r) => r.ok);
}

/** silence engine console noise for a clean trace (restore after). */
export function quietConsole<T>(fn: () => T): T {
    const saved = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        assert: console.assert,
    };
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.assert = () => {};
    try {
        return fn();
    } finally {
        Object.assign(console, saved);
    }
}
