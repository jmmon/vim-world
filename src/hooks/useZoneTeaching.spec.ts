import { describe, expect, test } from "vitest";
import {
    ZONE_TEACHES,
    createZoneTeachingMachine,
    stepZoneTeaching,
    zoneIndexAtX,
} from "~/hooks/useZoneTeaching";
import { GameState } from "~/hooks/useState";
import { WorldEntity } from "~/types/worldTypes";

// The teaching state machine is pure so it can be unit-tested without a DOM:
// zone entry shows the verb, the correct action auto-dismisses, and a stuck
// player gets a sit-then-nudge hint after STUCK_MS.

const STUCK = 3000;
const now = 1_000_000;

/** build a minimal ctx-shaped state for the pure machine. */
function makeState(overrides: {
    x?: number;
    itemIds?: string[];
    doorSolid?: boolean;
    idleStartTime?: number;
} = {}): GameState {
    const door: WorldEntity = {
        id: "DOOR-1",
        type: "DOOR",
        pos: { x: 26, y: 10 },
        collision: { solid: overrides.doorSolid ?? true },
    };
    const state = {
        ctx: {
            client: {
                player: {
                    pos: { x: overrides.x ?? 0, y: 10 },
                    itemIds: overrides.itemIds,
                },
                idleStartTime: overrides.idleStartTime ?? -1,
            },
            world: { entities: new Map<string, WorldEntity>([[door.id, door]]) },
        },
    } as unknown as GameState;
    return state;
}

describe("zoneIndexAtX", () => {
    test("maps world-x to the intro zone index", () => {
        expect(zoneIndexAtX(3)).toBe(0); // open room
        expect(zoneIndexAtX(7)).toBe(1); // gap
        expect(zoneIndexAtX(12)).toBe(2); // chest
        expect(zoneIndexAtX(24)).toBe(3); // keyhole/door
    });

    test("returns -1 outside the designed corridor", () => {
        expect(zoneIndexAtX(-1)).toBe(-1);
        expect(zoneIndexAtX(100)).toBe(-1);
    });
});

describe("stepZoneTeaching — zone entry", () => {
    test("shows the verb when the player enters a zone", () => {
        const m = createZoneTeachingMachine();
        const s = makeState({ x: 3 });

        const { hint } = stepZoneTeaching(m, s, now, STUCK);
        expect(hint).toEqual({ show: true, verb: ZONE_TEACHES[0].verb });
    });

    test("hides the verb once the player leaves the zone", () => {
        const m = createZoneTeachingMachine();
        // enter zone 1 (x=3), then move to x=50 (no zone)
        stepZoneTeaching(m, makeState({ x: 3 }), now, STUCK);
        const { hint } = stepZoneTeaching(
            { lastZoneIndex: 0, stuckAt: -1 },
            makeState({ x: 50 }),
            now,
            STUCK,
        );
        expect(hint).toEqual({ show: false, verb: "" });
    });
});

describe("stepZoneTeaching — auto-dismiss on the correct action", () => {
    test("zone 2 (gap) hint is replaced once the player crosses the gap", () => {
        // enter the gap (x=7) → shows the hop verb
        const entry = stepZoneTeaching(
            createZoneTeachingMachine(),
            makeState({ x: 7 }),
            now,
            STUCK,
        );
        expect(entry.hint).toEqual({ show: true, verb: ZONE_TEACHES[1].verb });

        // step into the chest zone (x=8) → gap hint gone, chest hint shows
        const crossed = stepZoneTeaching(
            entry.machine,
            makeState({ x: 8 }),
            now,
            STUCK,
        );
        expect(crossed.hint.show).toBe(true);
        expect(crossed.hint.verb).not.toBe(ZONE_TEACHES[1].verb);
        expect(crossed.hint.verb).toBe(ZONE_TEACHES[2].verb);
    });

    test("zone 3 (chest) hides once the player has the key in inventory", () => {
        const m = { lastZoneIndex: 2, stuckAt: -1 };
        const solved = stepZoneTeaching(
            m,
            makeState({ x: 12, itemIds: ["789"] }),
            now,
            STUCK,
        );
        expect(solved.hint).toEqual({ show: false, verb: "" });
    });

    test("zone 3 (chest) shows while the key is uncollected", () => {
        const { hint } = stepZoneTeaching(
            createZoneTeachingMachine(),
            makeState({ x: 12, itemIds: [] }),
            now,
            STUCK,
        );
        expect(hint).toEqual({ show: true, verb: ZONE_TEACHES[2].verb });
    });

    test("zone 4 (keyhole) hides once the door's collision is released", () => {
        const m = { lastZoneIndex: 3, stuckAt: -1 };
        const solved = stepZoneTeaching(
            m,
            makeState({ x: 24, doorSolid: false }),
            now,
            STUCK,
        );
        expect(solved.hint).toEqual({ show: false, verb: "" });
    });
});

describe("stepZoneTeaching — sit-then-nudge", () => {
    test("shows a hint only after STUCK_MS idle in an unsolved zone", () => {
        const m = { lastZoneIndex: 1, stuckAt: -1 }; // in the gap, unsolved
        // before the threshold: no hint
        const early = stepZoneTeaching(
            m,
            makeState({ x: 7, idleStartTime: now - 1000 }),
            now,
            STUCK,
        );
        expect(early.hint).toEqual({ show: false, verb: "" });

        // after the threshold: nudge
        const late = stepZoneTeaching(
            { lastZoneIndex: 1, stuckAt: -1 },
            makeState({ x: 7, idleStartTime: now - (STUCK + 1) }),
            now,
            STUCK,
        );
        expect(late.hint).toEqual({ show: true, verb: ZONE_TEACHES[1].verb });
        // machine records that the nudge fired
        expect(late.machine.stuckAt).toBe(now);
    });

    test("never nudges a skilled player who is moving (idle advances)", () => {
        const m = { lastZoneIndex: 1, stuckAt: -1 };
        const { hint } = stepZoneTeaching(
            m,
            makeState({ x: 7, idleStartTime: now - 50 }),
            now,
            STUCK,
        );
        expect(hint).toEqual({ show: false, verb: "" });
    });

    test("keeps the nudge up on subsequent frames until solved", () => {
        const m = { lastZoneIndex: 1, stuckAt: now - 10 }; // already nudged
        const { hint } = stepZoneTeaching(
            m,
            makeState({ x: 7, idleStartTime: now - (STUCK + 5) }),
            now,
            STUCK,
        );
        expect(hint).toEqual({ show: true, verb: ZONE_TEACHES[1].verb });
    });
});

describe("stepZoneTeaching — no player", () => {
    test("never shows a hint without a player", () => {
        const state = { ctx: { client: { player: undefined } } } as unknown as GameState;
        const { hint } = stepZoneTeaching(
            createZoneTeachingMachine(),
            state,
            now,
            STUCK,
        );
        expect(hint).toEqual({ show: false, verb: "" });
    });
});
