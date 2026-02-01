import { Direction, MapObject, Player, TileType, Vec2 } from "~/types/worldTypes";

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

export function deltaToDirection(delta: Vec2): Direction | undefined {
    // Update facing direction
    switch (true) {
        case delta.x > 0:
            return 'E';
        case delta.x < 0:
            return 'W';
        case delta.y > 0:
            return 'S';
        case delta.y < 0:
            return 'N';
        default:
            return undefined;
    }
}

export const combinePos = (pos: Vec2, delta: Vec2): Vec2 => ({
    x: pos.x + delta.x,
    y: pos.y + delta.y,
});

export const isWithinBounds = (map: TileType[][], next: Vec2): boolean =>
    !!map[next.y]?.[next.x];

export function isWalkable(
    world: {
        objects: MapObject[];
        map: TileType[][];
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
    const obj = world.objects.find(
        ({pos}) => pos && pos.x === next.x && pos.y === next.y,
    );
    if (obj?.walkable === false) {
        console.error("reached unwalkable object:", obj);
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

export function updateDirection(p: Player, delta: Vec2) {
    // Update facing direction
    switch (true) {
        case delta.x > 0:
            p.dir = "E";
            return;
        case delta.x < 0:
            p.dir = "W";
            return;
        case delta.y > 0:
            p.dir = "S";
            return;
        case delta.y < 0:
            p.dir = "N";
            return;
        default:
            return;
    }
}


export function dirToDelta(dir: Direction): Vec2 {
    switch (dir) {
        case "W":
            return { x: -1, y: 0 };
        case "E":
            return { x: 1, y: 0 };
        case "S":
            return { x: 0, y: -1 };
        case "N":
            return { x: 0, y: 1 };
    }
}

export function applyRangeToDelta(range: number = 1, delta: Vec2): Vec2 {
    return {
        x: delta.x * range,
        y: delta.y * range
    };
}


