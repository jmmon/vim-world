import { Player, Vec2, World } from "~/components/canvas1/types";
import { GameAction } from "./types";
import draw from "~/components/canvas1/draw";

export function keyToDirection(key?: string): Vec2 | null {
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
export const computeTargetPos = (pos: Vec2, delta: Vec2): Vec2 => ({
    x: pos.x + delta.x,
    y: pos.y + delta.y,
});

export const isWithinBounds = (world: World, next: Vec2): boolean =>
    !!world.map[next.y]?.[next.x];
// next.x >= 0 &&
// next.y >= 0 &&
// next.x < world.dimensions.width &&
// next.y < world.dimensions.height;

export function isWalkable(world: World, next: Vec2) {
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

type Opts = {
    collision: boolean;
    prediction: boolean;
};
const OPTS = {
    collision: true,
    prediction: true,
};
export function applyMoveAction(
    world: World,
    action: GameAction,
    opts: Partial<Opts> = OPTS,
) {
    const { prediction, collision }: Opts = {
        ...OPTS,
        ...opts,
    };
    if (!prediction) return;

    const delta = keyToDirection(action.key);
    if (!delta) return;

    const steps = action.count ?? 1;
    const p = world.player;
    updateDirection(p, delta); // always update direction even if they didn't move

    for (let i = 0; i < steps; i++) {
        const next = computeTargetPos(p.pos, delta);

        if (collision && !isWithinBounds(world, next)) {
            console.error("not within bounds!", p.pos, next);
            break; // stop at map edge
        }

        if (collision && !isWalkable(world, next)) {
            break; // stop at obstacle or player
        }

        p.pos = next; // commit step
    }
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
    if (action.command === "help" || action.command === "h" || action.command === 'g?') {
        if (world.help.isOpen) {
            draw.closeHelp(world, overlayCtx);
        } else {
            draw.help(world, overlayCtx);
        }
        world.help.isOpen = !world.help.isOpen;
        return;
    }

    if (action.command === "ctrl+[") {
        // show some menu
        // a dialog component
        // can basically toggle state.isOpen to true/false
        // so would probably need the world state to be a store (or context)
        console.log("TODO: 'ctrl+[' => show some menu");
        return;
    }
}
