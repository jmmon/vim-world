import { CHUNK_HEIGHT, CHUNK_WIDTH, Chunk, MapConfig, TILE_SIZE_PX, Zone, generateChunk, getChunkSeed, mulberry32, zone } from "~/server/map";
import { Vec2 } from "~/types/worldTypes";

// server AND client: chunk cache
const chunkCache = new Map<ChunkKey, Chunk>();
export type ChunkKey = `${number},${number}`;

// generateBaseTile: world coords matter later for biomes & paths
function getChunkByWorldCoords(worldX: number, worldY: number, zone: Zone): Chunk {
    const { cx, cy } = getChunkSlot({x: worldX, y: worldY});
    const key: ChunkKey = `${cx},${cy}`;
    if (!chunkCache.has(key)) {
        const chunk = generateChunk(zone.seed, worldX, worldY, zone.ruleset);
        chunkCache.set(key, chunk);
    }
    return chunkCache.get(key)!;
}
function getChunkByKey(key: ChunkKey, zone: Zone) {
    const worldCoords = getWorldCoordsByChunkKey(key);
    return getChunkByWorldCoords(worldCoords.x, worldCoords.y, zone);
}


function unloadChunk(key: ChunkKey) {
    chunkCache.delete(key);
}

function parseKey(key: ChunkKey) {
    return key.split(',').map(Number) as [number, number];
}

/** @returns cell coords */
function getWorldCoordsByChunkKey(key: ChunkKey) {
    const [cx, cy] = parseKey(key);
    return { x: cx * CHUNK_WIDTH, y: cy * CHUNK_HEIGHT };
}


/* get all chunks in map for entity placement */
function getMap(zone: Zone, config: MapConfig): Chunk[][] {
    const chunkMap: Chunk[][] = [];
    for (let y = 0; y < config.height; y++) {
        chunkMap.push([]);
        for (let x = 0; x < config.width; x++) {
            chunkMap[y][x] = getChunkByWorldCoords(x * CHUNK_WIDTH, y * CHUNK_HEIGHT, zone);
        }
    }
    return chunkMap
}

const isSameChunk = (chunk1: Vec2<'chunk'>, chunk2: Vec2<'chunk'>) =>
    chunk1.cx === chunk2.cx && chunk1.cy === chunk2.cy;




/** @returns the chunk's slot coords
 * @example: world coords: 0, 0 => chunk slot: 0, 0
 * @example: world coords: 32, 0 => chunk slot: 1, 0
 * @example: world coords: 64, 0 => chunk slot: 2, 0
 * */
const getChunkSlot = (worldPos: Vec2): Vec2<'chunk'> => ({
    cx: Math.floor(worldPos.x / CHUNK_WIDTH),
    cy: Math.floor(worldPos.y / CHUNK_HEIGHT)
});
const getChunkOrigin = (worldPos: Vec2): Vec2 => {
    const { cx, cy } = getChunkSlot(worldPos);
    const factorX = CHUNK_WIDTH * TILE_SIZE_PX
    const factorY = CHUNK_HEIGHT * TILE_SIZE_PX
    return { x: cx * factorX, y: cy * factorY };
}

const isSameChunkByPos = (pos1: Vec2, pos2: Vec2) =>
    isSameChunk(getChunkSlot(pos1), getChunkSlot(pos2));

/** @returns coords within a chunk 
 * @example: world coords: 1, 1 => chunk coords: 1, 1
 * @example: world coords: 33, 1 => chunk coords: 1, 1
 * @example: world coords: 65, 1 => chunk coords: 1, 1
 * */
const getLocalChunkCoords = (worldPos: Vec2): Vec2<'local'> => ({
    lx: worldPos.x % CHUNK_WIDTH,
    ly: worldPos.y % CHUNK_HEIGHT,
});

function getChunkRng(chunkSeed: number) {
    return mulberry32(chunkSeed);
}
function getChunkRngByPos(pos: Vec2, worldSeed: number) {
    const { cx, cy } = getChunkSlot(pos);
    const chunkSeed = getChunkSeed(worldSeed, cx, cy);
    return mulberry32(chunkSeed);
}


function isChunkWithinBounds(mapConfig: MapConfig, key: ChunkKey): boolean {
    const [x, y] = parseKey(key);
    return x >= 0 &&
        y >= 0 &&
        x < mapConfig.width &&
        y < mapConfig.height;
}

/** should always be sorted left => right, top => bottom */
let __visibleChunks: ChunkKey[] = [];
const VIEW_RADIUS = 1; // 3x3; 2 => 5x5
function setVisibleChunks(pos: Vec2, mapConfig: MapConfig) {
    const { cx, cy } = getChunkSlot(pos);
    const visibleChunkSlots: ChunkKey[] = [];

    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
            const key: ChunkKey = `${cx + dx},${cy + dy}`;
            if (!isChunkWithinBounds(mapConfig, key)) continue;
            visibleChunkSlots.push(key);
        }
    }
    __visibleChunks = visibleChunkSlots;
}


function ensureChunksLoaded(visibleChunks: ChunkKey[]) {
    for (const key of visibleChunks) {
        getChunkByKey(key, zone);
    }
}

function unloadInvisibleChunks(visibleChunks: ChunkKey[]) {
    for (const _key in chunkCache) {
        const key = _key as ChunkKey;
        if (!visibleChunks.includes(key)) {
            unloadChunk(key);
        }
    }
}

function handleChunkChange(playerPos: Vec2, mapConfig: MapConfig) {
    setVisibleChunks(playerPos, mapConfig);
    unloadInvisibleChunks(__visibleChunks);
    ensureChunksLoaded(__visibleChunks);
    // console.log('done setting visible chunks::', __visibleChunks);
}



const chunkService = {
    parseKey,
    getChunk: getChunkByWorldCoords,
    getChunkByKey,
    getChunkSlot,
    getChunkOrigin,
    getChunkRng,
    getChunkRngByPos,
    getLocalChunkCoords,
    getMap,
    handleVisibleChunksChange: handleChunkChange,
    isSameChunk,
    isSameChunkByPos,
    getWorldCoordsByChunkKey,
    /** run every frame or when player crosses chunk boundary */
};

export default chunkService;
export {__visibleChunks};

