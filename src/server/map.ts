import chunkService from "~/services/chunk";
import { getTileByWorldCoords, getWorldCoordsFromChunkLocal, isPosWithinMapgen } from "~/simulation/shared/helpers";
import { Direction, Tile, TileType, WorldEntity } from "~/types/worldTypes";
import { parseIntroMap } from "~/server/mapParser";
import type { IntroMapSource } from "~/server/mapParser";

export const TILE_SIZE_PX = 32; // px

export const CHUNK_WIDTH = 32; // tiles
export const CHUNK_HEIGHT = CHUNK_WIDTH; // tiles

const SCALE_DEFAULT = 1;

// ===================== PHASE 0 INTRO MAP =====================
// One hand-made map that proves the core loop: move → hop → pick up key →
// place on keyhole → door opens. Four zones laid out left-to-right along a
// corridor at world y=10, carved out of a procedural forest base that surrounds
// the path with water/terrain so the player stays on the designed route.
//
//   zone 1 (x2..6)  open room — `hjkl`
//   gap    (x7)     1-tile WATER gap — hop across with `w`
//   zone 2 (x8..27) corridor — chest holds the key (`yi"`), keyhole unlocks the door (`pi"`)
//   zone 3 (x28..31) end room — walk through the now-open door
//
// The designed path is forced GRASS (and the gap forced WATER); everything else
// is the seed-dependent procedural base. Niche cells at (12,8/9) and (20,8/9)
// step up to the chest and keyhole so the player faces them from the corridor.
// the grid covers the whole mapgen area (4×4 chunks × CHUNK_WIDTH tiles).
const INTRO_ROWS = 4 * CHUNK_HEIGHT;
const INTRO_COLS = 4 * CHUNK_WIDTH;

/**
 * The Phase 0 intro map, authored as a compact ASCII grid plus a `defs` object
 * of hand-placed entities, all in world coordinates. This is the single source
 * of truth for the intro level; the parser turns it into the `zone` shape the
 * engine already expects (procedural forest base + forced-tile overlay +
 * entities). See docs/agents/map-ascii-plan.md.
 *
 * ASCII grid: each cell is one of:
 *   . GRASS    ~ WATER    , DIRT    # CLIFF
 *   S SPAWN    C CHEST    O KEYHOLE    D DOOR    T TREE    B BOX    N STONE
 *   (space) = leave to the seed-dependent procedural base
 *
 * The grid is compact and positioned by `origin` (world coords of the top-left
 * cell); the parser expands it into a full INTRO_ROWS × INTRO_COLS grid.
 */
export const INTRO_MAP: IntroMapSource = {
    origin: [0, 0],
    seed: 12345678,
    baseRuleset: "forest-v1" as const,
    grid: [
        //
        "################################",
        "#                              #",
        "#                              #",
        "#                              #",
        "#                              #",
        "#           .........        #",
        "#                              #",
        "#    ~.........................#",
        // center =========================================================================
        "#   ........................... ",
        "#                              #",
        "#                              #",
        "#                              #",
        "#                              #",
        "#                              #",
        "#                              #",
        "################################",
    ],
    defs: {
        "4,7": { id: "SPAWN-1", type: "SPAWN", dir: "E" },
        "12,8": {
            id: "CHEST-KEY",
            type: "CHEST",
            collision: { solid: true },
            container: { capacity: 1, itemIds: ["789"], behavior: "PERSIST" },
            interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
        },
        "17,5": {
            id: "KEYHOLE-1",
            type: "KEYHOLE",
            link: "a",
            collision: { solid: true },
            container: { capacity: 1, itemIds: [], behavior: "PERSIST" },
            interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
        },
        "31,8": {
            id: "DOOR-1",
            type: "DOOR",
            link: "a",
            collision: { solid: true },
            state: { kind: "DOOR", open: false, locked: true },
        },
    },
    zones: [
        { id: "room1", xRange: [0, 6], verb: "Move with h j k l" },
        { id: "gap", xRange: [7, 7], verb: "Hop across with w" },
        { id: "chest", xRange: [8, 19], verb: 'Take the key with yi"', solved: { takeKey: "a" } },
        { id: "keyhole", xRange: [20, 27], verb: 'Place the key with pi"', solved: { openDoor: "DOOR-1" } },
    ],
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

export interface Chunk {
    cx: number;
    cy: number;
    tiles: Tile[][];
    seed: number;
    dirty: boolean;
    // playerIds: [],
    // staticEntityIds: [],
}

type RuleSetId = "forest-v1" | "dungeon-v1";

/**
 * An ambient effect applied to a single tile in a hand-authored zone.
 * Orthogonal to what the tile *is* — a gale covers grass/dirt, it isn't the
 * ground itself. Direction drives both the push and the particle animation.
 */
export type TileEffect =
    | { kind: "gale"; dir: Direction; force: number };

/**
 * A hand-authored zone. Two layers:
 *
 *  1. A procedural **base** terrain, seeded by `seed` + `baseRuleset` — gives the
 *     map natural character (coastlines, biomes) for free.
 *  2. A sparse forced-tile **grid** overlay — hand-placed terrain for the
 *     teaching moments (a gap, a chest clearing, the door path). Where a tile is
 *     in the grid it wins over the procedural base.
 *
 * `effects` are ambient behaviour placed on top (a gale). They never change
 * terrain type or collision — they augment it.
 *
 * `entities` are hand-placed objects at FIXED world positions (door, keyhole,
 * key in a chest). Procedural zones ignore this; their entities are scattered
 * randomly from `ENTITIES_LIST`.
 */
export interface AuthoredEntity
    extends Omit<WorldEntity, "id" | "pos"> {
    /** stable id; if omitted one is generated from the zone seed */
    id?: string;
    x: number;
    y: number;
}

export interface HandAuthoredZone {
    ruleset: "hand-authored";
    seed: number;
    /** what procedural terrain to seed the base from */
    baseRuleset: "forest-v1" | "dungeon-v1";
    /**
     * World coords of the top-left cell of the forced `grid` (ASCII cell
     * `(row r, col c)` → world `(origin[0] + c, origin[1] + r)`). Applied when
     * reading forced tiles; a cell outside the grid falls through to the
     * procedural base. Optional for hand-built zones (defaults to world 0,0).
     */
    origin?: [number, number];
    /** forced tiles [y][x], world coords. A `undefined` cell is left to the
     *  seed-dependent procedural base (so the base gives the map its character
     *  and keeps generation seed-sensitive); a placed tile overrides it. */
    grid?: Array<Array<TileType | undefined>>;
    /** sparse overlay of ambient effects */
    effects?: Array<{ x: number; y: number; effect: TileEffect }>;
    /** hand-placed entities at fixed world positions (door/keyhole/key/chest) */
    entities?: AuthoredEntity[];
}

export type Zone =
    | { seed: number; ruleset: RuleSetId }
    | HandAuthoredZone;

export function isHandAuthoredZone(zone: Zone): zone is HandAuthoredZone {
    return zone.ruleset === "hand-authored";
}

interface TileBand {
    type: TileType;
    max: number;
    collision?: Tile["collision"];
}

interface Ruleset {
    id: RuleSetId;
    elevation: { cellSize: number; octaves: number };
    bands: TileBand[];
    cliff?: { cellSize: number; octaves: number; threshold: number };
    border: Tile;
}

const COLLISION = { solid: true } as const;
/** a solid tile a two-tile hop (`w`/`b`) may clear — the one-tile gaps */
const HOP_COLLISION = { solid: true, hoppable: true } as const;
const RULESETS: Record<RuleSetId, Ruleset> = {
    "forest-v1": {
        id: "forest-v1",
        elevation: { cellSize: 14, octaves: 4 },
        bands: [
            { type: "WATER", max: 0.35, collision: HOP_COLLISION },
            { type: "DIRT", max: 0.42 },
            { type: "GRASS", max: 1 },
        ],
        cliff: { cellSize: 6, octaves: 2, threshold: 0.78 },
        border: { type: "CLIFF", collision: COLLISION },
    },
    "dungeon-v1": {
        id: "dungeon-v1",
        elevation: { cellSize: 16, octaves: 3 },
        bands: [
            { type: "WATER", max: 0.14, collision: HOP_COLLISION },
            { type: "GRASS", max: 0.36 },
            { type: "DIRT", max: 1 },
        ],
        cliff: { cellSize: 5, octaves: 2, threshold: 0.74 },
        border: { type: "CLIFF", collision: COLLISION },
    },
};

// TODO:
// function ensureSpawnReachable(map: Tile[][]) {
//     // BFS / flood fill from spawn
//     // i think this means to fill walkable tiles from spawn and ensure there's a straight path to the end
//     // If invalid → regenerate or fix
// }

/* ================== NOISE ================ */

function latticeValue(seed: number, x: number, y: number) {
    return hash32(seed, x, y) / 0x100000000;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(seed: number, x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep(x - x0);
    const ty = smoothstep(y - y0);

    const v00 = latticeValue(seed, x0, y0);
    const v10 = latticeValue(seed, x0 + 1, y0);
    const v01 = latticeValue(seed, x0, y0 + 1);
    const v11 = latticeValue(seed, x0 + 1, y0 + 1);

    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;

    return top + (bottom - top) * ty;
}

export function fbm(
    seed: number,
    x: number,
    y: number,
    cellSize: number,
    octaves: number,
): number {
    let value = 0;
    let amplitude = 1;
    let totalAmplitude = 0;
    let frequency = 1 / cellSize;

    for (let o = 0; o < octaves; o++) {
        value += valueNoise((seed + o * 0x9e3779b9) | 0, x * frequency, y * frequency) * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / totalAmplitude;
}

export function generateTileAt(
    zone: Zone,
    wx: number,
    wy: number,
): Tile {
    // Hand-authored zones fall back to their procedural base ruleset.
    const ruleset: RuleSetId = isHandAuthoredZone(zone)
        ? zone.baseRuleset
        : zone.ruleset;
    const rules = RULESETS[ruleset];
    if (!rules) throw new Error(`Unknown ruleset: ${ruleset}`);

    if (rules.cliff) {
        const detail = fbm(
            (zone.seed ^ 0x9e3779b9) | 0,
            wx,
            wy,
            rules.cliff.cellSize,
            rules.cliff.octaves,
        );
        if (detail > rules.cliff.threshold) {
            return { type: "CLIFF", collision: COLLISION };
        }
    }

    const elevation = fbm(
        zone.seed,
        wx,
        wy,
        rules.elevation.cellSize,
        rules.elevation.octaves,
    );
    const band =
        rules.bands.find((b) => elevation < b.max) ??
        rules.bands[rules.bands.length - 1];

    return { type: band.type, collision: band.collision };
}

/** collision derived from tile type — matches the procedural rule exactly. */
export function collisionForTile(type: TileType): Tile["collision"] {
    return type === "WATER"
        ? HOP_COLLISION
        : type === "CLIFF"
            ? COLLISION
            : undefined;
}

/**
 * The effective tile at a world position for a hand-authored zone: the
 * procedural base terrain, overridden by a forced tile if one is placed there,
 * then augmented by an ambient effect if one is placed there. The effect layer
 * runs last so it attaches even where a tile is also forced.
 */
export function getHandAuthoredTileAt(
    zone: HandAuthoredZone,
    wx: number,
    wy: number,
): Tile {
    // 1. procedural base (the hybrid: seed + base ruleset gives character)
    let type = baseTypeAt(zone, wx, wy);

    // 2. forced tile overrides the base, positioned by `origin`. A cell outside
    //    the grid falls through to the procedural base (it is NOT clamped to an
    //    edge row/col — that would bleed the border tiles across the whole map).
    if (zone.grid) {
        const rows = zone.grid.length;
        const cols = zone.grid[0]?.length ?? 0;
        const gy = wy - (zone.origin?.[1] ?? 0);
        const gx = wx - (zone.origin?.[0] ?? 0);
        if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
            const forced = zone.grid[gy][gx];
            if (forced !== undefined) type = forced;
        }
    }

    const tile: Tile = { type, collision: collisionForTile(type) };

    // 3. ambient effect augments (never changes type or collision)
    const placed = zone.effects?.find((e) => e.x === wx && e.y === wy);
    if (placed) return { ...tile, effect: placed.effect };

    return tile;
}

export function baseTypeAt(zone: HandAuthoredZone, wx: number, wy: number): TileType {
    return generateTileAt(zone, wx, wy).type;
}

/** the effective ambient effect at a world position, if any */
export function getHandAuthoredEffectAt(
    zone: HandAuthoredZone,
    wx: number,
    wy: number,
): TileEffect | undefined {
    return zone.effects?.find((e) => e.x === wx && e.y === wy)?.effect;
}

export function generateHandAuthoredChunk(
    zone: HandAuthoredZone,
    x: number,
    y: number,
): Chunk {
    const { cx, cy } = chunkService.getChunkSlot({ x, y });

    const tiles: Tile[][] = [];
    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        const row: Tile[] = [];
        for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
            const tile = getHandAuthoredTileAt(
                zone,
                cx * CHUNK_WIDTH + lx,
                cy * CHUNK_HEIGHT + ly,
            );
            row.push(tile);
        }
        tiles.push(row);
    }

    return { cx, cy, tiles, seed: zone.seed, dirty: true };
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

/* ====================================== */
/* ============== CHUNKS ================ */
/* ====================================== */

export function generateChunk(
    zone: Zone,
    x: number,
    y: number,
): Chunk {
    const { cx, cy } = chunkService.getChunkSlot({ x, y });

    if (isHandAuthoredZone(zone)) {
        return generateHandAuthoredChunk(zone, x, y);
    }

    const seed = getChunkSeed(zone.seed, cx, cy);

    const tiles: Tile[][] = [];

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        const row: Tile[] = [];
        for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
            const tile = generateTileAt(
                zone,
                cx * CHUNK_WIDTH + lx,
                cy * CHUNK_HEIGHT + ly,
            );
            row.push(tile);
        }
        tiles.push(row);
    }

    return { cx: cx, cy: cy, tiles, seed, dirty: true, };
}

// Phase 0 intro `zone`: authored as the ASCII source `INTRO_MAP` above, parsed
// into the `HandAuthoredZone` shape the engine expects. The chest's container
// carries the item's legacy prevId (`"789"`); `objects.ts` maps it to the
// concrete generated key id at build time — so `zone` lives here synchronously
// and every other module that imports `zone` from `~/server/map` keeps working.
export const zone: Zone = parseIntroMap(INTRO_MAP);
