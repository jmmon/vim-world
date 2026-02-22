import { MapDimensions, Tile, Vec2 } from "~/types/worldTypes";

export const zone: Zone = {
    seed: 1234567,
    ruleset: "forest-v1",
};
export const MAP_CONFIG: MapConfig = {
    width: 4,
    height: 4,
};

const TILE_SIZE_PX = 32; // px
export const CHUNK_SIZE = 32; // tiles
const SCALE_DEFAULT = 1;

const WORLD_WIDTH_BLOCKS = CHUNK_SIZE * MAP_CONFIG.width;
const WORLD_HEIGHT_BLOCKS = CHUNK_SIZE * MAP_CONFIG.height;

export const DIMENSIONS: MapDimensions = {
    worldWidthBlocks: WORLD_WIDTH_BLOCKS,
    worldHeightBlocks: WORLD_HEIGHT_BLOCKS,
    tileSize: TILE_SIZE_PX,
    viewportWidthPx: CHUNK_SIZE * TILE_SIZE_PX,
    viewportHeightPx: CHUNK_SIZE * TILE_SIZE_PX,
    viewportWidthBlocks: CHUNK_SIZE,
    viewportHeightBlocks: CHUNK_SIZE,
    scale: SCALE_DEFAULT,
};

export function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hash32(a: number, b: number, c: number) {
    let h = a ^ (b * 374761393) ^ (c * 668265263);
    h = (h ^ (h >> 13)) * 1274126177;
    return h >>> 0;
}
function chunkSeed(worldSeed: number, cx: number, cy: number) {
    return hash32(worldSeed, cx, cy);
}

/** @returns the chunk's slot coords
 * @example: world coords: 0, 0 => chunk slot: 0, 0
 * @example: world coords: 32, 0 => chunk slot: 1, 0
 * @example: world coords: 64, 0 => chunk slot: 2, 0
 * */
export const getChunkSlot = (worldPos: Vec2): Vec2<'chunk'> => ({
    chunkX: Math.floor(worldPos.x / CHUNK_SIZE),
    chunkY: Math.floor(worldPos.y / CHUNK_SIZE)
});

/** @returns coords within a chunk 
 * @example: world coords: 1, 1 => chunk coords: 1, 1
 * @example: world coords: 33, 1 => chunk coords: 1, 1
 * @example: world coords: 65, 1 => chunk coords: 1, 1
 * */
export const getLocalChunkCoords = (worldPos: Vec2): Vec2<'local'> => ({
    localX: worldPos.x % CHUNK_SIZE,
    localY: worldPos.y % CHUNK_SIZE,
});

// chunk numbers
export interface MapConfig {
    width: number;
    height: number;
}
export type Zone = {
    seed: number;
    ruleset: RuleSetId;
};

export interface Chunk {
    cx: number;
    cy: number;
    tiles: Tile[][];
}

// type TileType2 = "floor" | "wall" | "water" | "grass" | "tree";
interface TileRule extends Tile {
    weight: number;
    spread: number;
}
type RuleSetId = "forest-v1" | "dungeon-v1";
interface Ruleset {
    id: RuleSetId;
    baseTiles: TileRule[];
    border: TileRule;
}

const COLLISION = { solid: true };
const RULESETS: Record<RuleSetId, Ruleset> = {
    "forest-v1": {
        id: "forest-v1",
        baseTiles: [
            { type: "GRASS", weight: 1, spread: 0.4 },
            { type: "DIRT", weight: 0.8, spread: 0.4 },
            { type: "CLIFF", weight: 0.1, spread: 0.4, collision: COLLISION },
            { type: "WATER", weight: 0.3, spread: 1, collision: COLLISION },
        ],
        border: {
            type: "CLIFF",
            weight: 1,
            spread: 1,
            collision: COLLISION,
        },
    },
    "dungeon-v1": {
        id: "dungeon-v1",
        baseTiles: [
            { type: "DIRT", weight: 0.9, spread: 0.5 },
            { type: "CLIFF", weight: 0.05, spread: 0.4, collision: COLLISION },
            { type: "WATER", weight: 0.05, spread: 0.4, collision: COLLISION },
        ],
        border: {
            type: "CLIFF",
            weight: 1,
            spread: 1,
            collision: COLLISION,
        },
    },
};

// use on chunk.tiles
// could refactor to border the map instead of the chunk??
function addBorders(rng: () => number, chunk: Chunk, rulesetId: RuleSetId) {
    const h = chunk.tiles.length;

    const w = chunk.tiles[0].length;
    // opening only on left/right for now
    const openingLocation = Math.floor(rng() * w * 0.5);
    // console.log('addBorders: n: expect range between chunksize / 2', n, 'chunkSize:', chunk.tiles.length, 'r:', r, 'v:', v);

    for (let x = 0; x < w; x++) {
        chunk.tiles[0][x] = generateBorderTile(rulesetId); // top
        chunk.tiles[h - 1][x] = generateBorderTile(rulesetId); // bottom
    }

    // leave one opening on left and right sides, divergent from center
    for (let y = 0; y < h; y++) {
        if (y !== openingLocation) {
            chunk.tiles[y][0] = generateBorderTile(rulesetId); // left
        }
        if (y !== h - 1 - openingLocation) {
            chunk.tiles[y][w - 1] = generateBorderTile(rulesetId); // right
        }
    }
}
addBorders(() => 1, { cx: 0, cy: 0, tiles: [[]] }, "dungeon-v1");

// TODO: addWorldBorders





// function carveRoom(map: Tile[][], x: number, y: number, w: number, h: number) {
//     for (let dy = 0; dy < h; dy++) {
//         for (let dx = 0; dx < w; dx++) {
//             map[y + dy][x + dx] = { type: "floor", solid: false };
//         }
//     }
// }

// function generateRooms(map: Tile[][], rng: () => number) {
//     const roomCount = 5 + Math.floor(rng() * 5);
//
//     for (let i = 0; i < roomCount; i++) {
//         carveRoom(
//             map,
//             2 + Math.floor(rng() * 20),
//             2 + Math.floor(rng() * 20),
//             5,
//             5,
//         );
//     }
// }
// generateRooms([[]], () => 0)

// TODO:
// function ensureSpawnReachable(map: Tile[][]) {
//     // BFS / flood fill from spawn
//     // i think this means to fill walkable tiles from spawn and ensure there's a straight path to the end
//     // If invalid → regenerate or fix
// }

// TODO:
// export function generateMap(seed: number, ruleset: string): Tile[][] {
//     switch (ruleset) {
//         case "forest-v1":
//             return generateForest(seed);
//         case "dungeon-v1":
//             return generateDungeon(seed);
//         default:
//             throw new Error("Unknown ruleset");
//     }
// }
//
// // TODO:
// function generateForest(seed: number) {
//     console.log(seed);
//     return [[]];
// }
// function generateDungeon(seed: number) {
//     console.log(seed);
//     return [[]];
// }

// server usage:
// const map = generateMap(zone.seed, zone.ruleset);
// client usage:
// const map = generateMap(seed, ruleset);

/* ================== RULESETS ================ */

function pickWeighted(rng: () => number, tileOptions: TileRule[]) {
    const total = tileOptions.reduce((accum, o) => accum + o.weight, 0);
    let r = rng() * total;

    for (const o of tileOptions) {
        if (r < o.weight) return o;
        r -= o.weight;
    }

    return tileOptions[tileOptions.length - 1];
}

export function getSurroundingTiles(
    map: Tile[][],
    x: number,
    y: number,
): {
    N?: Tile; 
    NE?: Tile;
    E?: Tile;
    SE?: Tile;
    S?: Tile;
    SW?: Tile;
    W?: Tile
    NW?: Tile;
} {
    return {
        N: map[y - 1]?.[x],
        NE: map[y - 1]?.[x + 1],
        E: map[y]?.[x + 1],
        SE: map[y + 1]?.[x + 1],
        S: map[y + 1]?.[x],
        SW: map[y + 1]?.[x - 1],
        W: map[y]?.[x - 1],
        NW: map[y - 1]?.[x - 1],
    };
}

function spread(
    chunk: Chunk,
    x: number,
    y: number,
    rng: () => number,
    tileOptions: TileRule[],
) {
    // check each surrounding tile,
    const surrounding = getSurroundingTiles(chunk.tiles, x, y);
    const rulesetTilesMap = tileOptions.reduce<Record<string, TileRule>>(
        (accum, rule) => {
            accum[rule.type] = rule;
            return accum;
        },
        {}
    );

    // sum the types and weights I guess
    const values = Object.values(surrounding);
    const meta = values.reduce<{
        map: Record<string, { tile: Tile; weight: number }>;
        total: number;
    }>(
        (accum, tile) => {
            if (!tile) return accum;
            if (!accum.map) accum.map = {};
            const spreadWeight = rulesetTilesMap[tile?.type]?.spread || 0;

            const result = accum.map[tile?.type] || { tile, weight: 0 };
            // const multiplicativeWeight =
            //     result.weight === 0
            //         ? spreadWeight
            //         : (result.weight + 1) * (spreadWeight + 1) - 1;
            const additiveWeight =
                result.weight === 0
                    ? spreadWeight
                    : result.weight + spreadWeight;
            result.weight = additiveWeight;
            accum.map[tile?.type] = result;
            accum.total += additiveWeight;
            return accum;
        },
        { map: {}, total: 0 },
    );
    // see where RNG lands within all weights
    // get the tile associated with that weight

    let r = rng() * meta.total;

    for (const { tile, weight } of Object.values(meta.map)) {
        if (r < weight) return tile;
        r -= weight;
    }

    return chunk.tiles[y][x];
}

function spreadTiles(
    rng: () => number,
    chunk: Chunk,
    rulesetId: RuleSetId,
    opts: { ignoreEdges: Array<"N" | "S" | "W" | "E"> } = {
        ignoreEdges: ["N", "S", "E", "W"],
    },
) {
    const ruleset = RULESETS[rulesetId];
    if (!ruleset) throw new Error(`Unknown ruleset: ${rulesetId}`);

    for (let y = 0; y < CHUNK_SIZE; y++) {
        if (opts.ignoreEdges.includes("N") && y === 0) continue;
        if (opts.ignoreEdges.includes("S") && y === CHUNK_SIZE - 1) continue;
        for (let x = 0; x < CHUNK_SIZE; x++) {
            if (opts.ignoreEdges.includes("W") && x === 0) continue;
            if (opts.ignoreEdges.includes("E") && x === CHUNK_SIZE - 1) continue;
            chunk.tiles[y][x] = spread(chunk, x, y, rng, ruleset.baseTiles);
        }
    }
}
function spreadMap(
    rng: () => number,
    chunk: Chunk,
    rulesetId: RuleSetId,
    count: number,
    opts: { ignoreEdges: Array<"N" | "S" | "W" | "E"> } = {
        ignoreEdges: ["N", "S", "E", "W"],
    },
) {
    for (let i = 0; i < count; i++) {
        spreadTiles(rng, chunk, rulesetId, opts);
    }
}

function replaceWithSurround(
    rng: () => number,
    chunk: Chunk,
    x: number,
    y: number,
    rulesetId: RuleSetId,
) {
    const ruleset = RULESETS[rulesetId];
    const surrounding = getSurroundingTiles(chunk.tiles, x, y);
    const rulesetTilesMap = ruleset.baseTiles.reduce<Record<string, TileRule>>(
        (accum, rule) => {
            accum[rule.type] = rule;
            return accum;
        },
        {}
    );
    const map = Object.values(surrounding).reduce<
        Record<string, { tile: Tile; count: number }>
    >((accum, tile?: Tile) => {
        if (!tile?.type) return accum;
        const result = accum[tile?.type] || {
            tile,
            count: 0,
        };
        // doesn't work when using spread???
        result.count += rulesetTilesMap[tile?.type]?.weight || 0;
        accum[tile.type] = result;
        return accum;
    }, {});
    const sorted = Object.values(map).sort((a, b) => b.count - a.count);
    if (sorted.length === 1) {
        return sorted[0].tile;
    }


    const counted = sorted.reduce((accum, cur) => accum + cur.count, 0);
    // const highest = sorted[0];
    // if (x === 0) console.log({ sorted, highest });

    let r = rng() * counted;

    for (const { tile, count } of sorted) {
        if (r < count) return tile;
        r -= count;
    }

    return chunk.tiles[y][x];
}

function reduceOrphans(
    rng: () => number,
    chunk: Chunk,
    rulesetId: RuleSetId,
    opts: { ignoreEdges: Array<"N" | "S" | "W" | "E"> } = {
        ignoreEdges: ["N", "S", "E", "W"],
    },
) {
    for (let y = 0; y < chunk.tiles.length; y++) {
        if (opts.ignoreEdges.includes("N") && y === 0) continue;
        if (opts.ignoreEdges.includes("S") && y === CHUNK_SIZE - 1) continue;
        for (let x = 0; x < chunk.tiles[0].length; x++) {
            if (opts.ignoreEdges.includes("W") && x === 0) continue;
            if (opts.ignoreEdges.includes("E") && x === CHUNK_SIZE - 1) continue;
            chunk.tiles[y][x] = replaceWithSurround(rng, chunk, x, y, rulesetId);
        }
    }
}

function reduceMapOrphans(
    rng: () => number,
    chunk: Chunk,
    rulesetId: RuleSetId,
    count: number,
    opts: { ignoreEdges: Array<"N" | "S" | "W" | "E"> } = {
        ignoreEdges: ["N", "S", "E", "W"],
    },
) {
    for (let i = 0; i < count; i++) {
        reduceOrphans(rng, chunk, rulesetId, opts);
    }
}

function generateBaseTile(rng: () => number, rulesetId: RuleSetId): Tile {
    const ruleset = RULESETS[rulesetId];
    if (!ruleset) throw new Error(`Unknown ruleset: ${rulesetId}`);

    const rule = pickWeighted(rng, ruleset.baseTiles);

    return {
        type: rule.type,
        collision: rule.collision,
    };
}

function generateBorderTile(rulesetId: RuleSetId): Tile {
    const ruleset = RULESETS[rulesetId];
    if (!ruleset) throw new Error(`Unknown ruleset: ${rulesetId}`);
    return {
        type: ruleset.border.type,
        collision: ruleset.border.collision,
    };
}

// need consistent way to generate openings next to other chunks
// could just check nearby chunks for openings and copy that, else create a new opening?
// otherwise maybe rng based on the worldseed to create openings between chunks?
// function generateBorderOpening(rng: () => number, chunk: Chunk, rulesetId: RuleSetId) {
//
// }

/* ====================================== */
/* ============== CHUNKS ================ */
/* ====================================== */

// generateBaseTile: world coords matter later for biomes & paths
export function generateChunk(
    worldSeed: number,
    worldX: number,
    worldY: number,
    rulesetId: RuleSetId,
): Chunk {
    const { chunkX, chunkY } = getChunkSlot({ x: worldX, y: worldY });

    const seed = chunkSeed(worldSeed, chunkX, chunkY);
    const rng = mulberry32(seed);

    const tiles: Tile[][] = [];

    for (let y = 0; y < CHUNK_SIZE; y++) {
        const row: Tile[] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const tile = generateBaseTile(rng, rulesetId /*worldX, worldY*/);
            row.push(tile);
        }
        tiles.push(row);
    }

    const chunk = { cx: chunkX, cy: chunkY, tiles };
    // addBorders(rng, chunk, rulesetId);
    // TODO: addWorldBorders
    spreadMap(rng, chunk, rulesetId, 5, { ignoreEdges: ["N", "S", "E", "W"] });
    reduceMapOrphans(rng, chunk, rulesetId, 2, { ignoreEdges: ["N", "S", "E", "W"] });
    return chunk;
}



