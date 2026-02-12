import { CHUNK_SIZE } from "~/components/canvas1/constants";
import { Chunk, Zone, generateChunk } from "~/server/map";

// server AND client: chunk cache
export const chunkCache = new Map<string, Chunk>();

export function getChunk(worldX: number, worldY: number, zone: Zone): Chunk {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    const key = `${cx},${cy}`;
    console.log("getting chunk:", key);
    if (!chunkCache.has(key)) {
        const chunk = generateChunk(zone.seed, worldX, worldY, zone.ruleset);
        chunkCache.set(key, chunk);
    }
    return chunkCache.get(key)!;
}
const chunkService = {
    getChunk: getChunk,
};

export default chunkService;

