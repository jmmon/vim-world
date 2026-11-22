import { describe, expect, test } from "vitest";
import {
    createZoneTeachingMachine,
    stepZoneTeaching,
    zoneIndexAtX,
    zoneHintNeedsRedraw,
    type ZoneTeach,
} from "~/hooks/useZoneTeaching";
import { GameState } from "~/hooks/useState";
import { WorldEntity } from "~/types/worldTypes";
import { ITEMS_WITH_IDS } from "~/server/objects";

// The teaching state machine is pure so it can be unit-tested without a DOM:
// zone entry shows the verb, the correct action auto-dismisses, and a stuck
// player gets a sit-then-nudge hint after STUCK_MS.
//
// The machine reads a `teaches` list (the intro map derives one per zone). These
// tests pass their OWN fixture so they stay stable as the intro map is rebuilt
// room-by-room — the behaviour under test is the machine, not the map content.

const STUCK = 3000;
const now = 1_000_000;

// the key's canonical generated id (what a real inventory carries after yi"),
// derived from the source of truth rather than hardcoded.
const KEY_ID = ITEMS_WITH_IDS.find((i) => i.kind === "KEY")!.id;

/** a four-zone beat sheet: open room → gap → chest → keyhole/door. */
const TEACHES: ZoneTeach[] = [
    { xRange: [0, 6], verb: "Move with h j k l", isSolved: () => false },
    { xRange: [7, 7], verb: "Hop across with w", isSolved: () => false },
    {
        xRange: [8, 19],
        verb: 'Take the key with yi"',
        isSolved: (s) => (s.ctx.client.player?.itemIds ?? []).includes(KEY_ID),
    },
    {
        xRange: [20, 27],
        verb: 'Place the key with pi"',
        isSolved: (s) => {
            const door = s.ctx.world.entities.get("DOOR-1");
            return !!door && !door.collision?.solid;
        },
    },
];

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
    test("maps world-x to the zone index", () => {
        expect(zoneIndexAtX(3, TEACHES)).toBe(0); // open room
        expect(zoneIndexAtX(7, TEACHES)).toBe(1); // gap
        expect(zoneIndexAtX(12, TEACHES)).toBe(2); // chest
        expect(zoneIndexAtX(24, TEACHES)).toBe(3); // keyhole/door
    });

    test("returns -1 outside the designed corridor", () => {
        expect(zoneIndexAtX(-1, TEACHES)).toBe(-1);
        expect(zoneIndexAtX(100, TEACHES)).toBe(-1);
    });
});

describe("stepZoneTeaching — zone entry", () => {
    test("shows the verb when the player enters a zone", () => {
        const m = createZoneTeachingMachine();
        const s = makeState({ x: 3 });

        const { hint } = stepZoneTeaching(m, s, now, STUCK, TEACHES);
        expect(hint).toEqual({ show: true, verb: TEACHES[0].verb });
    });

    test("hides the verb once the player leaves the zone", () => {
        const m = createZoneTeachingMachine();
        // enter zone 1 (x=3), then move to x=50 (no zone)
        stepZoneTeaching(m, makeState({ x: 3 }), now, STUCK, TEACHES);
        const { hint } = stepZoneTeaching(
            { lastZoneIndex: 0, stuckAt: -1 },
            makeState({ x: 50 }),
            now,
            STUCK,
            TEACHES,
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
            TEACHES,
        );
        expect(entry.hint).toEqual({ show: true, verb: TEACHES[1].verb });

        // step into the chest zone (x=8) → gap hint gone, chest hint shows
        const crossed = stepZoneTeaching(
            entry.machine,
            makeState({ x: 8 }),
            now,
            STUCK,
            TEACHES,
        );
        expect(crossed.hint.show).toBe(true);
        expect(crossed.hint.verb).not.toBe(TEACHES[1].verb);
        expect(crossed.hint.verb).toBe(TEACHES[2].verb);
    });

    test("zone 3 (chest) hides once the player has the key in inventory", () => {
        const m = { lastZoneIndex: 2, stuckAt: -1 };
        const solved = stepZoneTeaching(
            m,
            makeState({ x: 12, itemIds: [KEY_ID] }),
            now,
            STUCK,
            TEACHES,
        );
        expect(solved.hint).toEqual({ show: false, verb: "" });
    });

    test("zone 3 (chest) shows while the key is uncollected", () => {
        const { hint } = stepZoneTeaching(
            createZoneTeachingMachine(),
            makeState({ x: 12, itemIds: [] }),
            now,
            STUCK,
            TEACHES,
        );
        expect(hint).toEqual({ show: true, verb: TEACHES[2].verb });
    });

    test("zone 4 (keyhole) hides once the door's collision is released", () => {
        const m = { lastZoneIndex: 3, stuckAt: -1 };
        const solved = stepZoneTeaching(
            m,
            makeState({ x: 24, doorSolid: false }),
            now,
            STUCK,
            TEACHES,
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
            TEACHES,
        );
        expect(early.hint).toEqual({ show: false, verb: "" });

        // after the threshold: nudge
        const late = stepZoneTeaching(
            { lastZoneIndex: 1, stuckAt: -1 },
            makeState({ x: 7, idleStartTime: now - (STUCK + 1) }),
            now,
            STUCK,
            TEACHES,
        );
        expect(late.hint).toEqual({ show: true, verb: TEACHES[1].verb });
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
            TEACHES,
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
            TEACHES,
        );
        expect(hint).toEqual({ show: true, verb: TEACHES[1].verb });
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
            TEACHES,
        );
        expect(hint).toEqual({ show: false, verb: "" });
    });
});

// Issue #5: the render loop must redraw the Zone Hint when the Verb text
// changes while the box is showing, not only on the show/hide edge (zone
// x-ranges are contiguous, so a zone transition flips only the text).
describe("zoneHintNeedsRedraw", () => {
    test("no redraw while showing with an unchanged verb (AC1)", () => {
        expect(zoneHintNeedsRedraw(true, "A", true, "A")).toBe(false);
    });

    test("redraw when the verb changes while still showing (AC2)", () => {
        expect(zoneHintNeedsRedraw(true, "A", true, "B")).toBe(true);
    });

    test("redraw on the hide edge (AC3)", () => {
        expect(zoneHintNeedsRedraw(true, "A", false, "")).toBe(true);
    });

    test("no redraw while hidden with empty text (AC4)", () => {
        expect(zoneHintNeedsRedraw(false, "", false, "")).toBe(false);
    });
});
