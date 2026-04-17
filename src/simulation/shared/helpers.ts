import { LocalWorldWrapper, Viewport } from "~/components/canvas1/types";
import { PlayerCheckpoint } from "~/server/checkpointService";
import { World, ServerWorldWrapper } from "~/server/types";
import chunkService from "~/services/chunk";
import { Direction, PLAYER_IGNORED_KEYS, Player, ServerPlayer, Tile, Vec2 } from "~/types/worldTypes";
import { ValidateMoveCorrection, ValidateMoveResult, ValidateMoveValid } from "../server/types";

const _stringify = (data: Record<any, any>) =>
    JSON.stringify(
        Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])),
    );

export const isSnapshotSame = <T extends PlayerCheckpoint | Player>(
    player: T,
    last: T,
) => _stringify(last) === _stringify(player);

export function playerSnapshot(state: LocalWorldWrapper, player?: Player) {
    return JSON.parse(JSON.stringify(player ?? state.client.player!));
}

export function mergePlayerState(
    state: LocalWorldWrapper,
    authoritativeState: Partial<ServerPlayer>,
) {
    const newPlayer = Object.fromEntries(
        Object.entries(authoritativeState).filter(
            ([k, v]) => !PLAYER_IGNORED_KEYS.includes(k) && v !== undefined,
        ),
    ) as Record<keyof Player, any>;
    state.client.player = playerSnapshot(state, newPlayer);
}

export function isValidMove(
    result: ValidateMoveResult,
): result is ValidateMoveValid | ValidateMoveCorrection {
    return (
        result.ok ||
        result.reason === "COLLISION" ||
        result.reason === "OUT_OF_BOUNDS"
    );
}



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

export const applyRangeToDelta = (range: number = 1, { x, y }: Vec2): Vec2 => ({
    x: x * range,
    y: y * range,
});

export const addPos = (pos: Vec2, delta: Vec2): Vec2 => ({
    x: pos.x + delta.x,
    y: pos.y + delta.y,
});
export const subtractPos = (next: Vec2, prev: Vec2): Vec2 => ({
    x: next.x - prev.x,
    y: next.y - prev.y,
});

/** @returns pixel offset from viewport origin
 * @example both negative values mean it's outside the viewport
 * @example both values greater than viewport width/height mean it's outside the viewport */
export function getViewportCoordsAsPx(
    posPx: Vec2,
    viewportOriginPx: Vec2,
): Vec2<"pixels"> {
    const { x: px, y: py } = subtractPos(posPx, viewportOriginPx);
    return { px, py };
}

/**
 * @example obj is at 32,32 === 1024,1024px */
export function isWithinViewport(
    viewport: Viewport,
    { px: x, py: y }: Vec2<"pixels">,
) {
    const { px, py } = getViewportCoordsAsPx({ x, y }, viewport.origin);
    return px >= 0 && py >= 0 && px < viewport.width && py < viewport.height;
}

export const isWithinBounds = (
    state: ServerWorldWrapper | LocalWorldWrapper,
    next: Vec2,
): boolean =>
    state.physics.collision === false ||
    (next.x >= 0 &&
        next.y >= 0 &&
        next.x < state.world.config.worldWidth &&
        next.y < state.world.config.worldHeight);

// collision will get the chunk that is needed
function getWorldTile(world: Pick<World, "zone">, pos: Vec2): Tile | undefined {
    const chunk = chunkService.getChunk(pos.x, pos.y, world.zone);
    const { lx, ly } = chunkService.getLocalChunkCoords(pos);
    return chunk.tiles?.[ly]?.[lx];
}

export function isWalkable(
    state: ServerWorldWrapper | LocalWorldWrapper,
    next: Vec2,
) {
    if (state.physics.collision === false) return true;
    // tile collision
    const tile = getWorldTile(state.world, next);
    if (tile?.collision?.solid) {
        console.error("unwalkable tile!", { tile });
        return false;
    }

    // later: e.g. chunk static entities, world dynamic entities
    // object collision
    const entity = Array.from(state.world.entities.values()).find(
        ({ pos }) => pos && pos.x === next.x && pos.y === next.y,
    );
    if (entity?.collision?.solid) {
        console.error("reached unwalkable object:", entity);
        return false;
    }

    // player collision
    if (state.world.players.size === 0) return true;

    for (const p of state.world.players.values()) {
        if (p.pos.x === next.x && p.pos.y === next.y) {
            console.error("cannot walk on other players", p);
            return false;
        }
    }

    return true;
}

const DIRECTIONS = [
    { dx: 0, dy: -1 }, // UP
    { dx: 1, dy: 0 }, // RIGHT
    { dx: 0, dy: 1 }, // DOWN
    { dx: -1, dy: 0 }, // LEFT
];
export function spiralSearch(
    pos: Vec2,
    maxRadius = Infinity,
    returnConditionFn: (pos: Vec2) => boolean,
) {
    if (returnConditionFn(pos)) return;

    let stepLength = 1;
    let dirIndex = 0;

    while (stepLength <= maxRadius * 2) {
        for (let repeat = 0; repeat < 2; repeat++) {
            const { dx, dy } = DIRECTIONS[dirIndex % 4];

            let steps = 0;
            while (steps < stepLength) {
                pos.x += dx;
                pos.y += dy;

                if (returnConditionFn(pos)) return;

                steps++;
            }

            dirIndex++;
        }

        stepLength++;
    }

    throw new Error(`!!no walkable tiles found in ${maxRadius} radius!!`);
}
