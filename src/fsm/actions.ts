import { NoSerialize } from "@builder.io/qwik";
import {
    ClientActionMessage,
    ClientCheckpointSaveMessage,
    ClientInitMessage,
    GameAction,
} from "./types";
import { Player, World } from "~/components/canvas1/types";
import { applyCommandAction, applyMoveAction } from "./movement";
import { PlayerCheckpoint } from "~/server/checkpoint";

export function dispatchActionToServer(
    ws: NoSerialize<WebSocket> | null,
    seq: number,
    action: GameAction,
) {
    // 3. Send to server
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;

    const data: ClientActionMessage = {
        type: "ACTION",
        seq,
        clientTime: Date.now(),
        action,
    };
    console.log("sending data:", data);
    ws.send(JSON.stringify(data));
}

// dispatch an init message
export function onInit(ws: NoSerialize<WebSocket>, player: Player) {
    console.log('onInit:', ws?.readyState);
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;

    // TODO:
    // could use localStorage to save a unique playerId on the browser!
    // later use Dash id or username
    const initMessage: ClientInitMessage = {
        type: "INIT",
        playerId: player.id,
    };
    console.log('sending init:', initMessage);
    ws.send(JSON.stringify(initMessage));
}

export function applyCheckpointToServer(
    ws: NoSerialize<WebSocket> | null,
    player: Player,
    isClosing?: boolean,
) {
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;
    // create player checkpoint
    const checkpoint: PlayerCheckpoint = {
        playerId: player.id,
        zoneId: "test",
        x: player.pos.x,
        y: player.pos.y,
        dir: player.dir,
        // inventory: string[];
        // hp: number;
        // maxHp?: number;
        lastSeenAt: Date.now(),
    };

    // use ws to send checkpoint data to server
    const checkpointMessage: ClientCheckpointSaveMessage = {
        type: "SAVE_CHECKPOINT",
        checkpoint: checkpoint,
        isClosing,
    };
    console.log('sending checkpoint:', checkpointMessage);
    ws.send(JSON.stringify(checkpointMessage));
}

/**
 * doesn't draw anything, only runs collision and updates world state
 * */
export function applyActionToWorld(
    world: World,
    action: GameAction,
    overlayCtx: CanvasRenderingContext2D,
    opts?: Partial<{
        collision: boolean,
        prediction: boolean,
    }>,
) {
    switch (action.type) {
        case "MOVE":
            applyMoveAction(world, action, opts);
            break;
        case "COMMAND":
            applyCommandAction(world, action, overlayCtx);
            break;
        default:
            break;
    }
}
