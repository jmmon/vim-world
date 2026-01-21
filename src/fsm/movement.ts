import { Player, Vec2, World } from "~/components/canvas1/types";
import { GameAction } from "./types";
import draw from "~/components/canvas1/draw";

function actionToDelta(action: GameAction): Vec2 | null {
    if (action.type !== "MOVE" || !action.key) return null;

    switch (action.key) {
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
const computeTargetPos = (pos: Vec2, delta: Vec2): Vec2 => ({
    x: pos.x + delta.x,
    y: pos.y + delta.y,
});

const isWithinBounds = (world: World, next: Vec2): boolean =>
    next.x >= 0 &&
    next.y >= 0 &&
    next.x < world.dimensions.width &&
    next.y < world.dimensions.height;

function isWalkable(world: World, next: Vec2) {
    // tile collision
    const tile = world.map[next.y]?.[next.x];
    if (!tile || !world.walkable.includes(tile)) {
        console.error("unwalkable tile:", { tile });
        return false;
    }

    // object collision
    const obj = world.objects.find(
        (o) => o.pos.x === next.x && o.pos.y === next.y,
    );
    if (obj?.walkable === false) {
        console.error("reached unwalkable object:", obj);
        return false;
    }

    // player collision
    const otherPlayer = world.otherPlayers.find(
        (o) => o.pos.x === next.x && o.pos.y === next.y,
    );
    if (otherPlayer) {
        console.error("cannot walk on other players", otherPlayer);
        return false;
    }

    return true;
}


export function applyMoveAction(world: World, action: GameAction) {
    const delta = actionToDelta(action);
    if (!delta) return;

    const steps = action.count ?? 1;
    const p = world.player;

    for (let i = 0; i < steps; i++) {
        const next = computeTargetPos(p.pos, delta);

        if (!isWithinBounds(world, next)) {
            console.error("not within bounds!", p.pos, next);
            break; // stop at map edge
        }

        if (!isWalkable(world, next)) {
            break; // stop at obstacle or player
        }

        p.pos = next; // commit step
    }

    updateDirection(p, delta); // always update direction even if they didn't move
}

function updateDirection(p: Player, delta: Vec2) {
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

export function applyCommandAction(
    world: World,
    action: GameAction,
    overlayCtx: CanvasRenderingContext2D,
) {
    if (action.command === "help" || action.command === "h") {
        if (world.help.isOpen) {
            draw.closeHelp(world, overlayCtx);
        } else {
            draw.help(world, overlayCtx);
        }
        world.help.isOpen = !world.help.isOpen;
    }
}
