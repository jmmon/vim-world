import { Direction, Player, TileType, Vec2, WorldEntity } from "~/types/worldTypes";

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

export const isWithinBounds = (map: TileType[][], next: Vec2): boolean =>
    !!map[next.y]?.[next.x];

export function isWalkable(
    world: {
        map: TileType[][];
        entities: Map<string, WorldEntity>;
        players: Map<string, Player>;
        walkable: TileType[];
    },
    next: Vec2,
) {
    // tile collision
    const tile = world.map[next.y]?.[next.x];
    if (!tile || !world.walkable.includes(tile)) {
        console.error("unwalkable tile:", { tile });
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

    for (const kvPair of world.players) {
        const p = kvPair[1];
        if (p.pos.x === next.x && p.pos.y === next.y) {
            console.error("cannot walk on other players", p);
            return false;
        }
    }

    return true;
}



