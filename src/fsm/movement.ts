import {
    LocalWorldWrapper,
    MapObject,
    Player,
    TileType,
    Vec2,
} from "~/components/canvas1/types";
import { GameAction } from "./types";
import { $ } from "@builder.io/qwik";

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
        (o) => o.pos.x === next.x && o.pos.y === next.y,
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

type Opts = {
    collision: boolean;
    prediction: boolean;
};
const OPTS = {
    collision: true,
    prediction: true,
};
export const applyMoveAction = $(async function (
    state: LocalWorldWrapper,
    action: GameAction,
    opts: Partial<Opts> = OPTS,
): Promise<boolean> {
    const { prediction, collision }: Opts = {
        ...OPTS,
        ...opts,
    };
    if (!prediction) return false;

    const delta = keyToDirection(action.key);
    if (!delta) return false;

    const steps = action.count ?? 1;
    const p = state.client.player!;
    updateDirection(p, delta); // always update direction even if they didn't move

    let processed = 0;
    for (; processed < steps; processed++) {
        const next = computeTargetPos(p.pos, delta);
        // console.log({processed, next});

        if (collision && (await state.isWithinBounds(next))) {
            console.error("not within bounds!", p.pos, next);
            break; // stop at map edge
        }

        if (collision && (await state.isWalkable(next))) {
            break; // stop at obstacle or player
        }

        p.pos = next; // commit step
    }
    // console.log({processed, p});
    return processed > 0;
});

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

const QUIT_ACTIONS = [
    "q",
    "quit",
    "qa",
    "qall",
    "quita",
    "quitall",
    "wq",
    "wqa",
    "wqall",
    "wa",
    "x",
    "xit",
    "exi",
    "exit",
];
// :q[uit][!], :wq[!], :wa[ll], :conf[irm] q[uit], :x[it], :exi[t], :[w]qa[ll][!], :quita[ll][!]
export function applyCommandAction(
    state: LocalWorldWrapper,
    action: GameAction,
    // overlayCtx: CanvasRenderingContext2D,
): boolean {
    if (
        action.command === "help" ||
        action.command === "h" ||
        action.command === "g?"
    ) {
        state.show.help = !state.show.help;
        return false;
    }

    if (action.command === "ctrl+[") {
        // show menu
        state.show.menu = !state.show.menu;
        return false;
    }
    // allow optional ! at end
    if (action.command!.endsWith("!")) {
        action.command = action.command!.slice(0, -1);
    }
    if (QUIT_ACTIONS.includes(action.command!)) {
        console.log(
            "TODO: quit command: save checkpoint then redirect to homepage",
        );
        return false;
    }
    return false;
}
