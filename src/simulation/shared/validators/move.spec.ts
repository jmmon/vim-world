import { describe, expect, test } from "vitest";
import { HandAuthoredZone, MAP_CONFIG } from "~/server/map";
import { TileType, Vec2, WorldEntity } from "~/types/worldTypes";
import { canHopAt } from "~/simulation/shared/helpers";
import validateMove from "~/simulation/shared/validators/move";
import { LocalWorldWrapper } from "~/simulation/client/types";

// `validateMove` returns a union; the invalid branch drops `target`, so the
// test helper narrows to the shape these assertions actually read.
type MoveResult = { reason?: string; target: Vec2 };

// `w`/`b` are two-tile horizontal moves. They hop over a one-tile gap (water) or
// open ground; they must NOT hop over a wall (a closed door, a cliff). The landing
// tile is always checked; a hop also clears the intermediate tile via `canHopAt`.
//
// A small deterministic hand-authored field so the rules are tested against known
// tiles — independent of the intro map (which is rebuilt room-by-room):
//   (5,7)  WATER  — a hoppable gap
//   (0,5)  CLIFF  — solid, not hoppable
//   (31,8) DOOR   — a solid entity on grass (blocks a hop, not walkable)
//   everything else in range is GRASS.
const W = 40;
const H = 12;
const grid: Array<Array<TileType | undefined>> = Array.from({ length: H }, () =>
    Array.from({ length: W }, (): TileType => "GRASS"),
);
grid[5][0] = "CLIFF";
grid[7][5] = "WATER";

const door: WorldEntity = {
    id: "DOOR-1",
    type: "DOOR",
    pos: { x: 31, y: 8 },
    collision: { solid: true },
};
const entities = new Map<string, WorldEntity>([[door.id, door]]);

const zone: HandAuthoredZone = {
    ruleset: "hand-authored",
    seed: 1,
    baseRuleset: "forest-v1",
    origin: [0, 0],
    grid,
};

const ctx = {
    physics: { collision: true },
    world: { zone, entities, players: new Map(), config: MAP_CONFIG },
} as unknown as LocalWorldWrapper;

function move(pos: { x: number; y: number }, key: string, count = 1): MoveResult {
    return validateMove(
        ctx as unknown as LocalWorldWrapper,
        { pos, dir: "E" } as never,
        { type: "MOVE", key, count } as never,
    ) as unknown as MoveResult;
}

describe("canHopAt — intermediate tile of a hop", () => {
    test("open ground (grass) is hoppable", () => {
        expect(canHopAt(ctx, { x: 29, y: 8 })).toBe(true);
    });

    test("a gap (water) is hoppable", () => {
        expect(canHopAt(ctx, { x: 5, y: 7 })).toBe(true);
    });

    test("a cliff is not hoppable", () => {
        expect(canHopAt(ctx, { x: 0, y: 5 })).toBe(false);
    });

    test("a solid entity (the door) is not hoppable", () => {
        expect(canHopAt(ctx, { x: 31, y: 8 })).toBe(false);
    });
});

describe("validateMove — w/b hop over gaps, not walls", () => {
    test("hops over the one-tile water gap (teaching works)", () => {
        const r = move({ x: 4, y: 7 }, "w");
        expect(r.reason).toBeUndefined();
        expect(r.target).toEqual({ x: 6, y: 7 });
    });

    test("hops over open grass (no regression)", () => {
        const r = move({ x: 28, y: 8 }, "w");
        expect(r.reason).toBeUndefined();
        expect(r.target).toEqual({ x: 30, y: 8 });
    });

    test("blocked at a closed door — cannot hop the intermediate tile", () => {
        const r = move({ x: 30, y: 8 }, "w");
        expect(r.reason).toBe("COLLISION");
        expect(r.target).toEqual({ x: 30, y: 8 }); // did not move
    });

    test("blocked at a closed door from the other direction (b)", () => {
        const r = move({ x: 32, y: 8 }, "b");
        expect(r.reason).toBe("COLLISION");
        expect(r.target).toEqual({ x: 32, y: 8 });
    });

    test("cannot hop past a door with a double hop (ww stops at the door)", () => {
        const r = move({ x: 30, y: 8 }, "w", 2);
        expect(r.reason).toBe("COLLISION");
        expect(r.target).toEqual({ x: 30, y: 8 });
    });
});
