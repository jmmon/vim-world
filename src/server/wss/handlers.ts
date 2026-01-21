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
import { clients } from "../serverState";
import checkpoint from "../checkpoint";


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

function handleServerAction(clientId: string, clientMessage: ClientActionMessage) {
    const client = clients.get(clientId)!;
    client.lastMessageTime = Date.now();
    client.isAfk = false;

    // 1. confirm the action is valid

    // 2. update local gamestate

    // 3. send back ACK and corrections
    const ack: ServerAckMessage = {
        type: "ACK",
        seq: clientMessage.seq,
        accepted: true,
        // correction: { x: 10, y: 7 },
    };
    client.ws.send(JSON.stringify(ack)); // e.g. send 'ACK'

    // 4. update other clients (e.g. send the player position update from local gamestate)
    const playerMove: ServerPlayerMoveMessage = {
        type: "PLAYER_MOVE",
        playerId: clientId,
        pos: { x: 10, y: 7 }, // TODO: actually calculate player's position to send correct value to other players
        facing: 'N'
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

    const checkpointMessage: ServerLoadCheckpointMessage = {
        type: "LOAD_CHECKPOINT",
        checkpoint: checkpointData,
    };
    client.ws.send(JSON.stringify(checkpointMessage)); // e.g. send 'ACK'
}

function handleSave(clientId: string, { checkpoint: checkpointData, isClosing }: ClientCheckpointSaveMessage) {
    const client = clients.get(clientId)!;
    if (isClosing) console.log('handleSave: CLOSING:', clientId, client, checkpointData);
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
