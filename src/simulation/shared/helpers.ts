import { getLocalChunkCoords } from "~/server/map";
import { World } from "~/server/types";
import chunkService from "~/services/chunk";
import { Direction, MapDimensions, Tile, Vec2 } from "~/types/worldTypes";

export function keyToDelta(key?: string): Vec2 | null {
    switch (key) {
        case "h":
            return { x: -1, y: 0 };
        case "l":
            return { x: 1, y: 0 };
        case "k":
            return { x: 0, y: -1 };
        case "j":
            return { x: 0, y: 1 };
        case "w":
            return { x: 2, y: 0 };
        case "b":
            return { x: -2, y: 0 };
        default:
            return null;
    }
}

export function deltaToDir(delta: Vec2): Direction {
    switch (true) {
        case delta.x > 0:
            return "E";
        case delta.x < 0:
            return "W";
        case delta.y > 0:
            return "S";
        case delta.y < 0:
            return "N";
        default: // for typescript
            return "E";
    }
}

export function dirToDelta(dir: Direction): Vec2 {
    switch (dir) {
        case "W":
            return { x: -1, y: 0 };
        case "E":
            return { x: 1, y: 0 };
        case "N":
            return { x: 0, y: -1 };
        case "S":
            return { x: 0, y: 1 };
    }
}

export function applyRangeToDelta(range: number = 1, delta: Vec2): Vec2 {
    return {
        x: delta.x * range,
        y: delta.y * range
    };
}

export const combinePos = (pos: Vec2, delta: Vec2): Vec2 => ({
    x: pos.x + delta.x,
    y: pos.y + delta.y,
});

// TODO: take chunks into account
// 
export const isWithinBounds = (dimensions: MapDimensions, next: Vec2): boolean =>
    next.x >= 0 &&
    next.y >= 0 &&
    next.x < dimensions.worldWidthBlocks &&
    next.y < dimensions.worldHeightBlocks;


// collision will get the chunk that is needed
function getWorldTile(world: World, pos: Vec2): Tile | undefined {
    const chunk = chunkService.getChunk(pos.x, pos.y, world.zone);
    const { localX, localY } = getLocalChunkCoords(pos);
    return chunk.tiles?.[localY]?.[localX];
}

export function isWalkable(
    world: World,
    next: Vec2,
) {
    // tile collision
    const tile = getWorldTile(world, next);
    if (tile?.collision?.solid) {
        console.error("unwalkable tile!", { tile });
        return false;
    }

    // object collision
    const entity = Array.from(world.entities.values()).find(
        ({pos}) => pos && pos.x === next.x && pos.y === next.y,
    );
    if (entity?.collision?.solid) {
        console.error("reached unwalkable object:", entity);
        return false;
    }

    // player collision
    if (world.players.size === 0) return true;

    for (const p of world.players.values()) {
        if (p.pos.x === next.x && p.pos.y === next.y) {
            console.error("cannot walk on other players", p);
            return false;
        }
    }

    return true;
}



