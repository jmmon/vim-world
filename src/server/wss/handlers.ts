import WebSocket from "ws";
import {
    ClientActionMessage,
    ClientCheckpointSaveMessage,
    ClientInitMessage,
    ClientMessage,
    ServerAckMessage,
    ServerLoadCheckpointMessage,
    ServerPlayerMoveMessage,
} from "~/fsm/types";
import { ClientData, WORLD, clients } from "../serverState";
import checkpoint from "../checkpoint";
import { applyAction, basicValidation } from "./validation";
import { Player } from "~/components/canvas1/types";
import { ReasonPartial, ReasonRejected } from "./types";


export const onConnect = (ws: WebSocket) => {
    const id = crypto.randomUUID();
    clients.set(id, { ws, lastMessageTime: Date.now(), isAfk: false, playerId: id }); // later set playerId to actual playerId
    console.log("Client connected", id);
    return id;
};

export const onMessage = (clientId: string) => (message: WebSocket.RawData) => {
    const clientMessage = JSON.parse(
        message.toString(),
    ) as ClientMessage;
    console.log("Received ClientMessage:", message.toString());

    switch(clientMessage.type) {
        case('ACTION'):
            handleServerAction(clientId, clientMessage);
            break;
        case('INIT'):
            handleInit(clientId, clientMessage);
            break;
        case('SAVE_CHECKPOINT'):
            handleSave(clientId, clientMessage);
            break;
    }

};

export const onClose = (clientId: string) => () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
};

export function sendRejection(client: ClientData, {seq, authoritativeState}: {seq: number; reason: ReasonRejected, authoritativeState: Player}) {
    const reject: ServerAckMessage<"REJECTION"> = {
        type: "REJECTION",
        seq,
        accepted: false, // true or false for corrections??
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(reject));
}

export function sendCorrection(client: ClientData, {seq, authoritativeState}: {seq: number, reason: ReasonPartial, authoritativeState: Player}) {
    const correction: ServerAckMessage<"CORRECTION"> = {
        type: "CORRECTION",
        seq,
        accepted: false, // true or false for corrections??
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(correction));
}

export function sendAck(client: ClientData, {seq, authoritativeState}: {seq: number, authoritativeState: Player}) {
    const ack: ServerAckMessage<"ACK"> = {
        type: "ACK",
        seq,
        accepted: true,
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(ack));
}

// actually should queue the action to be processed by the tick loop
function handleServerAction(clientId: string, clientMessage: ClientActionMessage) {
    const client = clients.get(clientId)!;
    client.lastMessageTime = Date.now();
    client.isAfk = false;
    // TODO: find this player and apply to this player

    // 1. confirm the action is valid
    const reason = basicValidation(WORLD.player, clientMessage);
    if (reason !== null) {
        return sendRejection(
            client,
            {
                seq: clientMessage.seq,
                reason,
                // authoritativeState: snapshotPlayer(player) // e.g. previous player state
                authoritativeState: WORLD.player,
            }
        );
    }

    // 2. update local gamestate
    applyAction(client, WORLD.player, clientMessage); // modify server world player state


    // 4. update OTHER clients (e.g. send the player position update from local gamestate)
    dispatchMoveToOthers(clientId);
}

function dispatchMoveToOthers(clientId: string) {
    const playerMove: ServerPlayerMoveMessage = {
        type: "PLAYER_MOVE",
        playerId: WORLD.player.id,
        pos: WORLD.player.pos,
        dir: WORLD.player.dir,
    };
    clients.forEach((client, key) => {
        if (key !== clientId) client.ws.send(JSON.stringify(playerMove));
    });
}


/**
 * register playerId, load checkpoint
 * */
function handleInit(clientId: string, { playerId }: ClientInitMessage) {
    // register the playerId
    const client = clients.get(clientId)!;
    client.lastMessageTime = Date.now();
    client.isAfk = false;
    client.playerId = playerId;

    const checkpointData = checkpoint.load(playerId); // default or existing
    // load checkpoint data into world state
    // TODO: push new player to players array, e.g. new player logged on
    WORLD.player = {
        ...WORLD.player,
        pos: { x: checkpointData.x, y: checkpointData.y },
        dir: checkpointData.dir,
        lastProcessedSeq: -1,
    }

    const checkpointMessage: ServerLoadCheckpointMessage = {
        type: "LOAD_CHECKPOINT",
        checkpoint: checkpointData,
    };
    client.ws.send(JSON.stringify(checkpointMessage)); // e.g. send 'ACK'
}

function handleSave(clientId: string, { checkpoint: checkpointData, isClosing }: ClientCheckpointSaveMessage) {
    const client = clients.get(clientId)!;
    if (client.playerId !== checkpointData.playerId) return;

    checkpoint.save(checkpointData);

    if (isClosing) {
        closeAfkPlayer(clientId);
    }
}



const AFK_TIME = 0.25 * 60 * 1000;
const DISCONNECT_TIME = 0.5 * 60 * 1000;
const TERMINATE_TIME = 10 * 1000; // 10s


function hasTimePassed(clientId: string, time: number) {
    if (!clients.has(clientId)) return false;
    return Date.now() > (clients.get(clientId)!.lastMessageTime + time);
}
export function markAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, AFK_TIME)) return;

    const client = clients.get(clientId)!;

    client.ws.send(JSON.stringify({type: 'AFK'}));
    console.log('~~ markAfkPlayer:', clientId);
    client.isAfk = true;
}


export function startCloseAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, DISCONNECT_TIME)) return;

    const client = clients.get(clientId)!;
    client.ws.send(JSON.stringify({ type: 'CLOSE_START' })); // client will then send a checkpoint
    console.log('~~ startCloseAfkPlayer:', clientId);
}

export function closeAfkPlayer(clientId: string) {
    const client = clients.get(clientId);
    console.log('~~ closeAfkPlayer:', clientId);
    if (!client) return;
    client.ws.send(JSON.stringify({ type: 'CLOSE' }));
    client.ws.close();
}

export function terminateAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, DISCONNECT_TIME + TERMINATE_TIME)) return;

    const client = clients.get(clientId)!;

    if ([client.ws.OPEN, client.ws.CLOSING].includes(client.ws.readyState)) {
        client.ws.send(JSON.stringify({type: 'TERMINATE'}));
        client.ws.terminate();
        clients.delete(clientId);
        console.log('~~ terminateAfkPlayer:', clientId);
    }
}
