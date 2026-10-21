import chunkService from "~/services/chunk";
import { getTileByWorldCoords, getWorldCoordsFromChunkLocal, isPosWithinMapgen } from "~/simulation/shared/helpers";
import { Tile, Vec2 } from "~/types/worldTypes";

export const TILE_SIZE_PX = 32; // px

export const CHUNK_WIDTH = 32; // tiles
export const CHUNK_HEIGHT = CHUNK_WIDTH; // tiles

const SCALE_DEFAULT = 1;

export const zone: Zone = {
    seed: 1234567,
    ruleset: "forest-v1",
};
export const MAP_CONFIG: MapConfig = {
    width: 4, // chunks
    height: 4, // chunks

    tileSize: TILE_SIZE_PX,
    chunkWidth: CHUNK_WIDTH,
    chunkHeight: CHUNK_HEIGHT,

    scale: SCALE_DEFAULT, // what should this do?
    lastScale: SCALE_DEFAULT,

    get chunkWidthPx() {
        return this.chunkWidth * this.tileSize;
    },
    get chunkHeightPx() {
        return this.chunkHeight * this.tileSize;
    },
    get worldWidth() {
        return this.width * this.chunkWidth;
    },
    get worldHeight() {
        return this.height * this.chunkHeight;
    },
    get worldWidthPx() {
        return this.worldWidth * this.tileSize;
    },
    get worldHeightPx() {
        return this.worldHeight * this.tileSize;
    }
};


type IgnoreEdgesOpts = Partial<{ ignoreEdges: Array<"N" | "S" | "W" | "E"> }>;

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

export function getChunkSeed(worldSeed: number, cx: number, cy: number) {
    return hash32(worldSeed, cx, cy);
}

// chunk numbers
export interface MapConfig {
    width: number;
    height: number;

    tileSize: number;
    chunkWidth: number;
    chunkHeight: number;
    scale: number; // what should this do?
    lastScale: number;
    chunkWidthPx: number;
    chunkHeightPx: number;
    worldWidth: number;
    worldHeight: number;
    worldWidthPx: number;
    worldHeightPx: number;
}
export type Zone = {
    seed: number;
    ruleset: RuleSetId;
};

export interface Chunk {
    cx: number;
    cy: number;
    tiles: Tile[][];
    seed: number;
    dirty: boolean;
    // playerIds: [],
    // staticEntityIds: [],
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
function addBorders(zone: Zone, rng: () => number, chunk: Chunk, _worldPos: Vec2,) {
    const h = chunk.tiles.length;

    const w = chunk.tiles[0].length;
    // opening only on left/right for now
    const openingLocation = Math.floor(rng() * w * 0.5);
    // console.log('addBorders: n: expect range between chunksize / 2', n, 'chunkSize:', chunk.tiles.length, 'r:', r, 'v:', v);

    for (let x = 0; x < w; x++) {
        chunk.tiles[0][x] = generateBorderTile(zone.ruleset); // top
        chunk.tiles[h - 1][x] = generateBorderTile(zone.ruleset); // bottom
    }

    // leave one opening on left and right sides, divergent from center
    for (let y = 0; y < h; y++) {
        if (y !== openingLocation) {
            chunk.tiles[y][0] = generateBorderTile(zone.ruleset); // left
        }
        if (y !== h - 1 - openingLocation) {
            chunk.tiles[y][w - 1] = generateBorderTile(zone.ruleset); // right
        }
    }
}

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
    zone: Zone,
    chunk: Chunk,
    lx: number,
    ly: number,
): {
    N?: Tile | false;
    NE?: Tile | false;
    E?: Tile | false;
    SE?: Tile | false;
    S?: Tile | false;
    SW?: Tile | false;
    W?: Tile | false;
    NW?: Tile | false;
} {
    const n = getWorldCoordsFromChunkLocal(chunk, lx, ly - 1);
    const e = getWorldCoordsFromChunkLocal(chunk, lx + 1, ly);
    const s = getWorldCoordsFromChunkLocal(chunk, lx, ly + 1);
    const w = getWorldCoordsFromChunkLocal(chunk, lx - 1, ly);

    const withinEast = isPosWithinMapgen(e);
    const withinNorth = isPosWithinMapgen(n);
    const withinWest = isPosWithinMapgen(w);
    const withinSouth = isPosWithinMapgen(s);
    // getTileByWorldCoords: causes a loop since it calls generateChunk
    return {
        N: withinNorth && getTileByWorldCoords(zone, n),
        NE: withinNorth && withinEast && getTileByWorldCoords(zone, getWorldCoordsFromChunkLocal(chunk, lx + 1, ly - 1)),
        E: withinEast && getTileByWorldCoords(zone, e),
        SE: withinSouth && withinEast && getTileByWorldCoords(zone, getWorldCoordsFromChunkLocal(chunk, lx + 1, ly + 1)),
        S: withinSouth && getTileByWorldCoords(zone, s),
        SW: withinSouth && withinWest && getTileByWorldCoords(zone, getWorldCoordsFromChunkLocal(chunk, lx - 1, ly + 1)),
        W: withinWest && getTileByWorldCoords(zone, w),
        NW: withinNorth && withinWest && getTileByWorldCoords(zone, getWorldCoordsFromChunkLocal(chunk, lx - 1, ly - 1)),
    };
}

function spread(
    zone: Zone,
    chunk: Chunk,
    lx: number, // local position within this chunk
    ly: number,
    rng: () => number,
    ruleset: Ruleset,
) {
    // check each surrounding tile,
    const surrounding = getSurroundingTiles(zone, chunk, lx, ly);
    const rulesetTilesMap = ruleset.baseTiles.reduce<Record<string, TileRule>>(
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

    return chunk.tiles[ly][lx];
}

function spreadTiles(
    zone: Zone,
    rng: () => number,
    chunk: Chunk,
    opts?: IgnoreEdgesOpts,
) {
    const ruleset = RULESETS[zone.ruleset];
    if (!ruleset) throw new Error(`Unknown ruleset: ${zone.ruleset}`);

    for (let ly = 0; ly < CHUNK_WIDTH; ly++) {
        if (opts?.ignoreEdges?.includes("N") && ly === 0) continue;
        if (opts?.ignoreEdges?.includes("S") && ly === CHUNK_WIDTH - 1) continue;
        for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
            if (opts?.ignoreEdges?.includes("W") && lx === 0) continue;
            if (opts?.ignoreEdges?.includes("E") && lx === CHUNK_WIDTH - 1) continue;
            chunk.tiles[ly][lx] = spread(zone, chunk, lx, ly, rng, ruleset);
        }
    }
}
function spreadMap(
    zone: Zone,
    rng: () => number,
    chunk: Chunk,
    count: number,
    opts?: IgnoreEdgesOpts,
) {
    for (let i = 0; i < count; i++) {
        spreadTiles(zone, rng, chunk, opts);
    }
}

function replaceWithSurround(
    zone: Zone,
    rng: () => number,
    chunk: Chunk,
    lx: number,
    ly: number,
) {
    const ruleset = RULESETS[zone.ruleset];
    const surrounding = getSurroundingTiles(zone, chunk, lx, ly);
    const rulesetTilesMap = ruleset.baseTiles.reduce<Record<string, TileRule>>(
        (accum, rule) => {
            accum[rule.type] = rule;
            return accum;
        },
        {}
    );
    const map = Object.values(surrounding).reduce<
        Record<string, { tile: Tile; count: number }>
    >((accum, tile?: Tile | false) => {
        if (!tile) return accum;
        const result = accum[tile.type] || {
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

    return chunk.tiles[ly][lx];
}

function reduceOrphans(
    zone: Zone,
    rng: () => number,
    chunk: Chunk,
    opts?: IgnoreEdgesOpts,
) {
    for (let ly = 0; ly < chunk.tiles.length; ly++) {
        if (opts?.ignoreEdges?.includes("N") && ly === 0) continue;
        if (opts?.ignoreEdges?.includes("S") && ly === CHUNK_WIDTH - 1) continue;
        for (let lx = 0; lx < chunk.tiles[0].length; lx++) {
            if (opts?.ignoreEdges?.includes("W") && lx === 0) continue;
            if (opts?.ignoreEdges?.includes("E") && lx === CHUNK_WIDTH - 1) continue;
            chunk.tiles[ly][lx] = replaceWithSurround(zone, rng, chunk, lx, ly);
        }
    }
}

function reduceMapOrphans(
    zone: Zone,
    rng: () => number,
    chunk: Chunk,
    count: number,
    opts?: IgnoreEdgesOpts,
) {
    for (let i = 0; i < count; i++) {
        reduceOrphans(zone, rng, chunk, opts);
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
const ADD_BORDERS = false;
const SPREAD_COUNT = 5;
const REDUCE_ORPHANS_COUNT = 2;
const IGNORE_EDGES_OPTS: IgnoreEdgesOpts = {
    ignoreEdges: ["N", "S", "E", "W"]
};
export function generateChunk(
    zone: Zone,
    x: number,
    y: number,
): Chunk {
    const worldPos = { x, y };
    const { cx, cy } = chunkService.getChunkSlot(worldPos);

    const seed = getChunkSeed(zone.seed, cx, cy);
    const rng = mulberry32(seed);

    const tiles: Tile[][] = [];

    for (let y = 0; y < CHUNK_WIDTH; y++) {
        const row: Tile[] = [];
        for (let x = 0; x < CHUNK_WIDTH; x++) {
            const tile = generateBaseTile(rng, zone.ruleset /*worldX, worldY*/);
            row.push(tile);
        }
        tiles.push(row);
    }

    const chunk = { cx: cx, cy: cy, tiles, seed, dirty: true, };
    if (ADD_BORDERS) addBorders(zone, rng, chunk, worldPos);
    // TODO: addWorldBorders around map config edges instead of single chunk edges
    // spreadMap(zone, rng, chunk, SPREAD_COUNT, ADD_BORDERS ? IGNORE_EDGES_OPTS : undefined);
    // reduceMapOrphans(zone, rng, chunk, REDUCE_ORPHANS_COUNT, ADD_BORDERS ? IGNORE_EDGES_OPTS : undefined);
    return chunk;
}



