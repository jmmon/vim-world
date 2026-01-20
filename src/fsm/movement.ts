import { Player, Vec2, World } from "~/components/canvas1/types";
import { GameAction } from "./types";
import { WALKABLE, WORLD } from "~/components/canvas1/canvas1";
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

const isWithinBounds = (world: World, next: Vec2): boolean => (
    next.x >= 0 &&
    next.y >= 0 &&
    next.x < world.dimensions.width &&
    next.y < world.dimensions.height
);


function isWalkable(next: Vec2) {
    // tile collision
    const tile = WORLD.map[next.y]?.[next.x];
    if (!tile || !WALKABLE.includes(tile)) {
        console.error("unwalkable tile:", { tile });
        return false;
    }

    // object collision
    const obj = WORLD.objects.find(
        (o) => o.pos.x === next.x && o.pos.y === next.y,
    );
    if (obj?.walkable === false) {
        console.error("reached unwalkable object:", obj);
        return false;
    }

    // player collision
    const otherPlayer = WORLD.otherPlayers.find(
        (o) => o.pos.x === next.x && o.pos.y === next.y,
    );
    if (otherPlayer) {
        console.error("cannot walk on other players", otherPlayer);
        return false;
    }

    return true;
}

export function applyActionToWorld(
    p: Player,
    action: GameAction,
    ctx: CanvasRenderingContext2D,
) {
    switch(action.type) {
        case('MOVE'): applyMoveAction(p, action);
            break;
        case('COMMAND'): applyCommandAction(p, action, ctx);
            break;
        default: break;
    }
}

export function applyMoveAction(p: Player, action: GameAction) {
    const delta = actionToDelta(action);
    if (!delta) return;

    const steps = action.count ?? 1;

    for (let i = 0; i < steps; i++) {
        const next = computeTargetPos(p.pos, delta);

        if (!isWithinBounds(WORLD, next)) {
            console.error("not within bounds!", p.pos, next);
            break; // stop at map edge
        }

        if (!isWalkable(next)) {
            break; // stop at obstacle or player
        }

        p.pos = next; // commit step
    }

    updateDirection(p, delta);
}

function updateDirection(p: Player, delta: Vec2) {
    // Update facing direction
    switch(true) {
        case(delta.x > 0): p.dir = "right";
            return;
        case(delta.x < 0): p.dir = "left";
            return;
        case(delta.y > 0): p.dir = "down";
            return;
        case(delta.y < 0): p.dir = "up";
            return;
        default:
            return;
    }
}

export function applyCommandAction(
    _: Player,
    action: GameAction,
    ctx: CanvasRenderingContext2D,
) {
    if (action.command === "help") {
        if (WORLD.help.isOpen) {
            draw.closeHelp(ctx);
        } else {
            draw.help(ctx);
        }
        WORLD.help.isOpen = !WORLD.help.isOpen;
    }
}
