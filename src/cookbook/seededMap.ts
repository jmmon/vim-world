import { CHUNK_SIZE } from "~/components/canvas1/constants";

export function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// const rng = mulberry32(seed);
// const n = rng(); // deterministic 0..1

export type TileType2 = "floor" | "wall" | "water" | "grass" | "tree";

export interface Tile2 {
    type: TileType2;
    solid: boolean;
}

export interface MapConfig2 {
    width: number;
    height: number;
}

export function generateBaseMap(seed: number, config: MapConfig2): Tile2[][] {
    const rng = mulberry32(seed);
    const map: Tile2[][] = [];

    for (let y = 0; y < config.height; y++) {
        const row: Tile2[] = [];
        for (let x = 0; x < config.width; x++) {
            const r = rng();

            let tile: Tile2;
            if (r < 0.1) {
                tile = { type: "water", solid: true };
            } else if (r < 0.2) {
                tile = { type: "tree", solid: true };
            } else {
                tile = { type: "floor", solid: false };
            }

            row.push(tile);
        }
        map.push(row);
    }

    return map;
}

function addBorders(map: Tile2[][]) {
    const h = map.length;
    const w = map[0].length;

    for (let x = 0; x < w; x++) {
        map[0][x] = { type: "wall", solid: true };
        map[h - 1][x] = { type: "wall", solid: true };
    }

    for (let y = 0; y < h; y++) {
        map[y][0] = { type: "wall", solid: true };
        map[y][w - 1] = { type: "wall", solid: true };
    }
}
addBorders([[]]);

function carveRoom(map: Tile2[][], x: number, y: number, w: number, h: number) {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            map[y + dy][x + dx] = { type: "floor", solid: false };
        }
    }
}

function generateRooms(map: Tile2[][], rng: () => number) {
    const roomCount = 5 + Math.floor(rng() * 5);

    for (let i = 0; i < roomCount; i++) {
        carveRoom(
            map,
            2 + Math.floor(rng() * 20),
            2 + Math.floor(rng() * 20),
            5,
            5,
        );
    }
}
generateRooms([[]], () => 0)

// TODO:
// function ensureSpawnReachable(map: Tile[][]) {
//     // BFS / flood fill from spawn
//     // i think this means to fill walkable tiles from spawn and ensure there's a straight path to the end
//     // If invalid → regenerate or fix
// }

// TODO:
export function generateMap(seed: number, ruleset: string): Tile2[][] {
    switch (ruleset) {
        case "forest-v1":
            return generateForest(seed);
        case "dungeon-v1":
            return generateDungeon(seed);
        default:
            throw new Error("Unknown ruleset");
    }
}

// TODO:
function generateForest(seed: number) {
    console.log(seed);
    return [[]];
}
function generateDungeon(seed: number) {
    console.log(seed);
    return [[]];
}

// server usage:
// const map = generateMap(zone.seed, zone.ruleset);
// client usage:
// const map = generateMap(seed, ruleset);

/* ====================================== */
/* ============== CHUNKS ================ */
/* ====================================== */

// TODO:
// function createChunk(x: number, y: number) {
//     const chunkX = Math.floor(x / CHUNK_SIZE);
//     const chunkY = Math.floor(y / CHUNK_SIZE);
//     const localX = x % CHUNK_SIZE;
//     const localY = y % CHUNK_SIZE;
// }

const worldSeed = 123456;

// function hash32(a: number, b: number, c: number) {
//     let h = a ^ (b * 374761393) ^ (c * 668265263);
//     h = (h ^ (h >> 13)) * 1274126177;
//     return h >>> 0;
// }

// function chunkSeed(worldSeed: number, cx: number, cy: number) {
//     return hash32(worldSeed, cx, cy);
// }

// interface Chunk {
//     cx: number;
//     cy: number;
//     tiles: Tile[][];
// }

// function generateChunk(
//     worldSeed: number,
//     worldX: number,
//     worldY: number,
//     ruleset: string,
// ): Chunk {
//     const chunkX = Math.floor(worldX / CHUNK_SIZE);
//     const chunkY = Math.floor(worldY / CHUNK_SIZE);
//     // const localX = worldX % CHUNK_SIZE;
//     // const localY = worldY % CHUNK_SIZE;
//
//     const seed = chunkSeed(worldSeed, chunkX, chunkY);
//     const rng = mulberry32(seed);
//
//     const tiles: Tile[][] = [];
//
//     for (let y = 0; y < CHUNK_SIZE; y++) {
//         const row: Tile[] = [];
//         for (let x = 0; x < CHUNK_SIZE; x++) {
//             row.push(generateBaseTile(rng, ruleset, worldX, worldY));
//         }
//         tiles.push(row);
//     }
//
//     return { cx: chunkX, cy: chunkY, tiles };
// }

// world coords matter later for biomes & paths
// function generateBaseTile(
//     rng: () => number,
//     ruleSet: string,
//     worldX: number,
//     worldY: number,
// ): Tile {
//     const r = rng();
//
//     if (r < 0.1) return { type: "water", solid: true };
//     if (r < 0.2) return { type: "tree", solid: true };
//     return { type: "floor", solid: false };
// }

// server AND client: chunk cache
// const chunkCache = new Map<string, Chunk>();

// function getChunk(worldX: number, worldY: number, ruleset: string): Chunk {
//     const cx = Math.floor(worldX / CHUNK_SIZE);
//     const cy = Math.floor(worldY / CHUNK_SIZE);
//     const key = `${cx},${cy}`;
//     if (!chunkCache.has(key)) {
//         chunkCache.set(key, generateChunk(worldSeed, worldX, worldY, ruleset));
//     }
//     return chunkCache.get(key)!;
// }

/* ================== RULESETS ================ */
interface TileRule2 {
    type: TileType2;
    weight: number;
    solid: boolean;
}

interface Ruleset2 {
    id: string;
    baseTiles: TileRule2[];
}
const RULESETS: Record<string, Ruleset2> = {
    "forest-v1": {
        id: "forest-v1",
        baseTiles: [
            { type: "floor", weight: 0.6, solid: false },
            { type: "tree", weight: 0.25, solid: true },
            { type: "water", weight: 0.15, solid: true },
        ],
    },
    "dungeon-v1": {
        id: "dungeon-v1",
        baseTiles: [
            { type: "floor", weight: 0.85, solid: false },
            { type: "wall", weight: 0.15, solid: true },
        ],
    },
};

function pickWeighted<T>(
    rng: () => number,
    options: { weight: number; value: T }[],
): T {
    const total = options.reduce((s, o) => s + o.weight, 0);
    let r = rng() * total;

    for (const o of options) {
        if (r < o.weight) return o.value;
        r -= o.weight;
    }

    return options[options.length - 1].value;
}

function generateBaseTile2(rng: () => number, rulesetId: string): Tile2 {
    const ruleset = RULESETS[rulesetId];
    if (!ruleset) throw new Error(`Unknown ruleset: ${rulesetId}`);

    const rule = pickWeighted(
        rng,
        ruleset.baseTiles.map((t) => ({
            weight: t.weight,
            value: t,
        })),
    );

    return {
        type: rule.type,
        solid: rule.solid,
    };
}

// wire into chunk generation:
const tiles = [];
const rng = mulberry32(worldSeed);
const ruleset = 'forest-v1';
for (let y = 0; y < CHUNK_SIZE; y++) {
    const row: Tile2[] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
        row.push(generateBaseTile2(rng, ruleset));
    }
    tiles.push(row);
}
