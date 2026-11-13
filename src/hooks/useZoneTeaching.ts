import { useVisibleTask$ } from "@builder.io/qwik";
import { GameState } from "./useState";

/**
 * Zone teaching for the Phase 0 intro map.
 *
 * Medium: a contextual hint panel (no blocking text box). Two triggers:
 *
 *  1. Zone entry — when the player crosses into a zone's position trigger
 *     region, show that zone's verb.
 *  2. Sit-then-nudge — after STUCK_MS stuck in one tile (idle with no successful
 *     action), show the current zone's verb as a fallback.
 *
 * The panel auto-dismisses the moment the player performs the correct action
 * (each zone's `isSolved`). One verb at a time. Reuses the existing help panel
 * style; the panel is a reference, not a gate.
 *
 * The state machine (`stepZoneTeaching`) is pure and unit-tested; this hook just
 * runs it on the rAF loop and writes the result into `state.ctx`.
 */

export interface ZoneTeach {
    /** inclusive world-x range that triggers this zone (the map is a left-to-right corridor) */
    xRange: [number, number];
    /** the verb this zone teaches, shown in the panel */
    verb: string;
    /** predicate: did the player just perform the correct action for this zone? */
    isSolved: (state: GameState) => boolean;
}

/** the intro beat sheet, one verb per zone, laid out left-to-right */
export const ZONE_TEACHES: ZoneTeach[] = [
    {
        // zone 1 — open room: just move with hjkl
        xRange: [0, 6],
        verb: "Move with h j k l",
        isSolved: () => false, // nothing to "solve"; stays until the player leaves
    },
    {
        // zone 2 — the gap: only a hop crosses it
        xRange: [7, 7],
        verb: "Hop across with w",
        isSolved: (state) => {
            const p = state.ctx.client.player;
            return !!p && p.pos.x >= 8;
        },
    },
    {
        // zone 3 — the chest: take the key inside (yi" puts it in inventory)
        xRange: [8, 19],
        verb: 'Take the key with yi"',
        isSolved: (state) =>
            !!state.ctx.client.player?.itemIds?.includes("789"),
    },
    {
        // zone 4 — the keyhole: place the key to open the door (pi")
        xRange: [20, 27],
        verb: 'Place the key with pi"',
        isSolved: (state) => {
            const door = state.ctx.world.entities.get("DOOR-1");
            return !!door && !door.collision?.solid;
        },
    },
];

/** which zone index contains world-x, or -1 if none. */
export function zoneIndexAtX(
    x: number,
    teaches: ZoneTeach[] = ZONE_TEACHES,
): number {
    for (let i = 0; i < teaches.length; i++) {
        const [lo, hi] = teaches[i].xRange;
        if (x >= lo && x <= hi) return i;
    }
    return -1;
}

export interface ZoneTeachingMachine {
    /** last zone index seen (-1 = none); detects entry */
    lastZoneIndex: number;
    /** timestamp the sit-then-nudge fired (-1 = not stuck) */
    stuckAt: number;
}

export function createZoneTeachingMachine(): ZoneTeachingMachine {
    return { lastZoneIndex: -1, stuckAt: -1 };
}

export interface ZoneHint {
    show: boolean;
    verb: string;
}

const DEFAULT_STUCK_MS = 3000;

/**
 * Pure teaching step. Given the machine, the current state and the wall-clock
 * time, returns the next machine + the hint to display.
 *
 *  - zone change → show on entry (unless already solved that same frame)
 *  - solved     → hide (auto-dismiss)
 *  - stuck long enough & unsolved & not yet shown → sit-then-nudge show
 *  - otherwise  → no hint
 */
export function stepZoneTeaching(
    machine: ZoneTeachingMachine,
    state: GameState,
    now: number,
    stuckMs: number = DEFAULT_STUCK_MS,
): { machine: ZoneTeachingMachine; hint: ZoneHint } {
    const next = {
        lastZoneIndex: machine.lastZoneIndex,
        stuckAt: machine.stuckAt,
    };

    const p = state.ctx.client.player;
    if (!p) return { machine: next, hint: { show: false, verb: "" } };

    const x = p.pos.x;
    const zoneIndex = zoneIndexAtX(x);
    const solved = zoneIndex >= 0 && ZONE_TEACHES[zoneIndex].isSolved(state);

    // idle window: idleStartTime is set on every input; a stuck player never
    // advances it past the tile they sit on, so it doubles as the stuck clock.
    const idleMs =
        state.ctx.client.idleStartTime > 0
            ? now - state.ctx.client.idleStartTime
            : 0;
    const isStuck = idleMs >= stuckMs;

    if (zoneIndex !== machine.lastZoneIndex) {
        // entered a (possibly new) zone this frame
        next.lastZoneIndex = zoneIndex;
        next.stuckAt = -1;
        if (zoneIndex < 0)
            return { machine: next, hint: { show: false, verb: "" } };
        if (solved) return { machine: next, hint: { show: false, verb: "" } };
        return {
            machine: next,
            hint: { show: true, verb: ZONE_TEACHES[zoneIndex].verb },
        };
    }

    // same zone as last frame
    if (solved) {
        // auto-dismiss on the correct action
        next.stuckAt = -1;
        return { machine: next, hint: { show: false, verb: "" } };
    }
    if (machine.stuckAt > 0) {
        // already nudged this zone; keep it up
        return {
            machine: next,
            hint: { show: true, verb: ZONE_TEACHES[zoneIndex].verb },
        };
    }
    if (isStuck) {
        next.stuckAt = now;
        return {
            machine: next,
            hint: { show: true, verb: ZONE_TEACHES[zoneIndex].verb },
        };
    }
    return { machine: next, hint: { show: false, verb: "" } };
}

/**
 * Wire the pure teaching machine into the render loop. Runs on a dedicated rAF
 * task (independent of the main loop) and writes `show.zoneHint` +
 * `zoneHintText` into the ctx each frame.
 */
export default function useZoneTeaching(state: GameState) {
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        const machine = createZoneTeachingMachine();
        let raf = 0;

        state.ctx.show.zoneHint = false;
        state.ctx.client.zoneHintText = "";

        const tick = () => {
            const { machine: nm, hint } = stepZoneTeaching(
                machine,
                state,
                Date.now(),
            );
            machine.lastZoneIndex = nm.lastZoneIndex;
            machine.stuckAt = nm.stuckAt;

            state.ctx.show.zoneHint = hint.show;
            state.ctx.client.zoneHintText = hint.verb;

            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    });
}
