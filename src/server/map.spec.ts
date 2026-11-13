import { describe, expect, test } from "vitest";
import {
    CHUNK_HEIGHT,
    CHUNK_WIDTH,
    MAP_CONFIG,
    Zone,
    generateChunk,
    generateTileAt,
    valueNoise,
    zone,
} from "~/server/map";
import { Tile } from "~/types/worldTypes";

const chunkSlots = Array.from({ length: MAP_CONFIG.height }, (_, cy) =>
    Array.from({ length: MAP_CONFIG.width }, (_, cx) => ({ cx, cy })),
).flat();

const chunkKey = ({ cx, cy }: { cx: number; cy: number }) => `${cx},${cy}`;

const flattenTiles = (chunks: Tile[][][]) => chunks.flat().flat();

describe("map generation determinism", () => {
    test("generates identical tiles for the same zone seed", () => {
        const first = generateChunk(zone, 0, 0);
        const second = generateChunk(zone, 0, 0);

        expect(second.tiles).toEqual(first.tiles);
    });

    test("chunk generation is order independent", () => {
        const forward = new Map(
            chunkSlots.map(({ cx, cy }) => [
                chunkKey({ cx, cy }),
                generateChunk(zone, cx * CHUNK_WIDTH, cy * CHUNK_HEIGHT),
            ]),
        );

        const reversed = [...chunkSlots].reverse();

        for (const { cx, cy } of reversed) {
            const chunk = generateChunk(zone, cx * CHUNK_WIDTH, cy * CHUNK_HEIGHT);
            expect(chunk.tiles).toEqual(forward.get(chunkKey({ cx, cy }))!.tiles);
        }
    });

    test("different seeds produce different maps", () => {
        const otherZone: Zone = { ...zone, seed: zone.seed + 1 };

        const typesFor = (z: Zone) =>
            flattenTiles([generateChunk(z, 0, 0).tiles]).map((tile) => tile.type);

        expect(typesFor(otherZone)).not.toEqual(typesFor(zone));
    });
});

describe("value noise", () => {
    test("is stable and within [0, 1)", () => {
        const samples = Array.from({ length: 25 }, (_, i) => ({
            x: i * 1.37 - 7,
            y: i * 0.53 + 3,
        }));

        for (const { x, y } of samples) {
            const value = valueNoise(zone.seed, x, y);
            expect(value).toBe(valueNoise(zone.seed, x, y));
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }

        const distinct = new Set(samples.map(({ x, y }) => valueNoise(zone.seed, x, y)));
        expect(distinct.size).toBeGreaterThan(1);
    });
});

describe("generated tiles", () => {
    test("are valid tile types with correct collision", () => {
        const tile = generateTileAt(zone, 10, 10);
        expect(tile.type).toBeTypeOf("string");

        const tiles = flattenTiles([generateChunk(zone, 0, 0).tiles]);
        const validTypes = new Set<string>(["GRASS", "WATER", "DIRT", "CLIFF"]);

        for (const t of tiles) {
            expect(validTypes.has(t.type)).toBe(true);
            if (t.type === "WATER" || t.type === "CLIFF") {
                expect(t.collision?.solid).toBe(true);
            }
        }
    });

    test("cover the full world with terrain variety", () => {
        const chunks = chunkSlots.map(({ cx, cy }) =>
            generateChunk(zone, cx * CHUNK_WIDTH, cy * CHUNK_HEIGHT),
        );

        for (const chunk of chunks) {
            expect(chunk.tiles).toHaveLength(CHUNK_HEIGHT);
            for (const row of chunk.tiles) {
                expect(row).toHaveLength(CHUNK_WIDTH);
            }
        }

        const tiles = flattenTiles(chunks.map((chunk) => chunk.tiles));
        expect(tiles).toHaveLength(MAP_CONFIG.worldWidth * MAP_CONFIG.worldHeight);

        const types = new Set(tiles.map((tile) => tile.type));
        expect(types.has("GRASS")).toBe(true);
        expect(types.has("WATER")).toBe(true);
    });
});
