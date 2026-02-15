import { CHUNK_SIZE } from "~/components/canvas1/constants";
import { Chunk, MapConfig, Zone, generateChunk } from "~/server/map";

// server AND client: chunk cache
const chunkCache = new Map<string, Chunk>();

// generateBaseTile: world coords matter later for biomes & paths
function getChunk(worldX: number, worldY: number, zone: Zone): Chunk {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    const key = `${cx},${cy}`;
    if (!chunkCache.has(key)) {
        const chunk = generateChunk(zone.seed, worldX, worldY, zone.ruleset);
        chunkCache.set(key, chunk);
    }
    return chunkCache.get(key)!;
}

function getMap(zone: Zone, config: MapConfig) {
    const chunkMap: Chunk[][] = [];
    for (let y = 0; y < config.height; y++) {
        chunkMap.push([]);
        for (let x = 0; x < config.width; x++) {
            chunkMap[y][x] = getChunk(x * CHUNK_SIZE, y * CHUNK_SIZE, zone);
        }
    }
    return chunkMap
}

const chunkService = {
    getChunk: getChunk,
    getMap: getMap,
};

export default chunkService;

