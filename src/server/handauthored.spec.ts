import { describe, expect, test } from "vitest";
import {
    HandAuthoredZone,
    baseTypeAt,
    getHandAuthoredTileAt,
    generateChunk,
    generateTileAt,
} from "~/server/map";
import { getTileByWorldCoords } from "~/simulation/shared/helpers";
import { TileType } from "~/types/worldTypes";

/**
 * Probe: prove a hand-authored zone is served through the SAME chunk/tile
 * accessors as procedural maps (generateChunk, getTileByWorldCoords).
 * If those work, the rest of the engine — collision, drawing, isWalkable — works.
 */

// grid[y][x], placed at world (0,0). A grass room with a DIRT tile and a
// WATER cell carrying a gale (force 1, pushing East).
const GRID: TileType[][] = [
    ["WATER", "WATER", "WATER", "WATER"],
    ["WATER", "GRASS", "GRASS", "WATER"],
    ["WATER", "GRASS", "DIRT", "WATER"],
    ["WATER", "WATER", "WATER", "WATER"],
];

const zone: HandAuthoredZone = {
    ruleset: "hand-authored",
    seed: 999,
    baseRuleset: "forest-v1",
    grid: GRID,
    effects: [
        { x: 2, y: 3, effect: { kind: "gale", dir: "E", force: 1 } },
    ],
};

const worldOf = (x: number, y: number) => ({ x, y });

describe("hand-authored zone — served through shared accessors", () => {
    test("generateChunk serves forced tiles at their world positions", () => {
        const chunk = generateChunk(zone, 0, 0);
        expect(chunk.tiles[1][1].type).toBe("GRASS"); // world (1,1)
        expect(chunk.tiles[2][2].type).toBe("DIRT");  // world (2,2)
    });

    test("getTileByWorldCoords (shared accessor) reads the forced terrain", () => {
        expect(getTileByWorldCoords(zone, worldOf(1, 1))?.type).toBe("GRASS");
        expect(getTileByWorldCoords(zone, worldOf(2, 2))?.type).toBe("DIRT");
    });

    test("collision is derived from tile type (WATER/CLIFF solid)", () => {
        expect(getTileByWorldCoords(zone, worldOf(0, 0))?.collision?.solid).toBe(true);
        expect(getTileByWorldCoords(zone, worldOf(1, 1))?.collision?.solid).toBeFalsy();
    });
});

describe("hand-authored zone — hybrid base + overlay", () => {
    test("forced tiles override the procedural base", () => {
        const forced = getHandAuthoredTileAt(zone, 2, 2);
        expect(forced.type).toBe("DIRT");

        // a position with no forced tile falls back to the procedural base
        const base = getHandAuthoredTileAt(zone, 40, 40);
        expect(["GRASS", "DIRT", "WATER", "CLIFF"]).toContain(base.type);
    });

    test("different base rulesets produce a different base under the overlay", () => {
        const forest: HandAuthoredZone = { ...zone, baseRuleset: "forest-v1" };
        const dungeon: HandAuthoredZone = { ...zone, baseRuleset: "dungeon-v1" };
        // search a small range for a forced-tile-free cell that differs
        let differ = false;
        for (let x = 40; x < 48 && !differ; x++) {
            for (let y = 40; y < 48 && !differ; y++) {
                if (baseTypeAt(forest, x, y) !== baseTypeAt(dungeon, x, y)) differ = true;
            }
        }
        expect(differ).toBe(true);
    });
});

describe("hand-authored zone — effects", () => {
    test("ambient effect is attached to its tile and derived correctly", () => {
        expect(getHandAuthoredTileAt(zone, 2, 3).effect).toEqual({
            kind: "gale", dir: "E", force: 1,
        });
        expect(getHandAuthoredTileAt(zone, 1, 1).effect).toBeUndefined();
    });

    test("effect does not change terrain type or collision", () => {
        const at = getHandAuthoredTileAt(zone, 2, 3);
        expect(at.type).toBe("WATER");
        expect(at.collision?.solid).toBe(true); // gale augments, doesn't rewrite
    });
});

describe("hand-authored zone — determinism & clamping", () => {
    test("same zone + position => same chunk", () => {
        expect(generateChunk(zone, 0, 0).tiles).toEqual(generateChunk(zone, 0, 0).tiles);
    });

    test("out-of-bounds world coords clamp to the nearest edge tile", () => {
        const negative = generateTileAt({ seed: zone.seed, ruleset: zone.baseRuleset }, -5, -5);
        expect(["GRASS", "DIRT", "WATER", "CLIFF"]).toContain(negative.type);

        // a forced tile beyond the grid clamps to the nearest grid cell
        expect(getHandAuthoredTileAt(zone, 9, 9).type).toBe("WATER"); // grid[3][3]
    });
});
