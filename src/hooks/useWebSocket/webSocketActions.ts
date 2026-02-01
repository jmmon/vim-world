import { NoSerialize } from "@builder.io/qwik";
import { Player } from "~/types/worldTypes";
import { VimAction } from "~/fsm/types";
import { ClientActionMessage, ClientCheckpointMessage, ClientInitMessage } from "~/types/messageTypes";
import { PlayerCheckpoint } from "~/server/checkpointService";


function action(
    ws: NoSerialize<WebSocket> | null,
    seq: number,
    action: VimAction,
) {
    // 3. Send to server
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;

    const data: ClientActionMessage = {
        type: "ACTION",
        seq,
        clientTime: Date.now(),
        action,
    };
    // console.log("sending data:", data);
    ws.send(JSON.stringify(data));
}

// dispatch an init message
function init(ws: NoSerialize<WebSocket>, playerId: string) {
    console.assert(ws && ws.readyState === WebSocket.OPEN, '!!websocket not open!! playerId:', playerId);
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;

    // TODO:
    // could use localStorage to save a unique playerId on the browser!
    // later use Dash id or username
    const initMessage: ClientInitMessage = {
        type: "INIT",
        playerId: playerId,
    };
    console.log('sending init so server keeps our id:', initMessage);
    ws.send(JSON.stringify(initMessage));
}

function checkpoint(
    ws: NoSerialize<WebSocket> | null,
    player: Player,
    isClosing?: boolean,
) {
    if (!ws || ws?.readyState !== WebSocket.OPEN) return;
    // create player checkpoint
    const checkpoint: PlayerCheckpoint = {
        level: player.level,
        name: player.name,
        playerId: player.id,
        zone: "default",
        x: player.pos.x,
        y: player.pos.y,
        dir: player.dir,
        // TODO: session: player.session,
        lastSeenAt: Date.now(),
    };

    // use ws to send checkpoint data to server
    const checkpointMessage: ClientCheckpointMessage<"SAVE"> = {
        type: "CHECKPOINT",
        subtype: "SAVE",
        checkpoint: checkpoint,
        isClosing,
    };
    console.log('sending checkpoint:', checkpointMessage);
    ws.send(JSON.stringify(checkpointMessage));
}

const dispatch = {
    init,
    action,
    checkpoint,
};
export default dispatch;


