import WebSocket from "ws";
import {
    ClientActionMessage,
    ClientCheckpointMessage,
    ClientInitMessage,
    ClientMessage,
    ServerAckMessage,
    ServerInitConfirmMessage,
    ServerOtherPlayerMessage,
} from "~/types/messageTypes";
import { WORLD_WRAPPER, clients } from "../serverState";
import checkpointService from "../checkpointService";
import { applyAction, basicValidation } from "../movement/validation";
import { Player } from "~/types/worldTypes";
import { ReasonCorrection, ReasonRejected } from "../movement/types";
import { closeAfkPlayer } from "./handleAfkDisconnect";
import { ClientData } from "../types";

const initializeClientData = (ws: WebSocket, id: string) => ({
    clientId: id,
    ws,
    lastMessageTime: Date.now(),
    isAfk: false,
    playerId: undefined,
    reset: function(this) {
        this.lastMessageTime = Date.now();
        this.isAfk = false;
    },
    disconnect: function(this) {
        this.ws.terminate();
        clients.delete(this.clientId);
    },
})

export const onConnect = (ws: WebSocket) => {
    const id = crypto.randomUUID();
    clients.set(id, initializeClientData(ws, id));
    console.log("Client connected", id);
    return id;
};

export const onMessage = (clientId: string) => (message: WebSocket.RawData) => {
    const clientMessage = JSON.parse(
        message.toString(),
    ) as ClientMessage;

    switch(clientMessage.type) {
        case('INIT'):
            handleInit(clientId, clientMessage);
            break;
        case('ACTION'):
            handleServerAction(clientId, clientMessage);
            break;
        case('CHECKPOINT'):
            if (clientMessage.subtype === 'SAVE') {
                handleSave(clientId, clientMessage as ClientCheckpointMessage<'SAVE'>);
            }
            break;
        default:
            console.log("UNHANDLED:: RECEIVED ClientMessage:", message.toString());
    }
};

export const onClose = (clientId: string) => () => {
    const client = clients.get(clientId);
    if (!client) return;
    const playerId = client.playerId;
    if (playerId) WORLD_WRAPPER.world.players.delete(playerId);
    client.disconnect();
    clients.delete(clientId);

    console.log(`Client ${clientId} disconnected`);
};

export function sendRejection(client: ClientData, {seq, authoritativeState, reason}: {seq: number; reason: ReasonRejected, authoritativeState: Player}) {
    const reject: ServerAckMessage<"ACK"> = {
        type: "ACK",
        subtype: "REJECTION",
        reason,
        seq,
        accepted: false, // true or false for corrections??
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(reject));
}

export function sendCorrection(client: ClientData, {seq, authoritativeState, reason}: {seq: number, reason: ReasonCorrection, authoritativeState: Player}) {
    const correction: ServerAckMessage<"ACK"> = {
        type: "ACK",
        subtype: "CORRECTION",
        reason,
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
        authoritativeState: authoritativeState,
    };
    client.ws.send(JSON.stringify(ack));
}

// actually should queue the action to be processed by the tick loop
function handleServerAction(clientId: string, clientMessage: ClientActionMessage) {
    const client = clients.get(clientId)!;
    client.reset();
    if (!client.playerId) return console.error('!!client has no playerId!!', client.playerId);
    // console.log('handleServerAction', clientMessage );
    const player = WORLD_WRAPPER.world.players.get(client.playerId);
    if (!player) return console.error('!!no player found for playerId:', client.playerId);
    // TODO: find this player and apply to this player

    // 1. confirm the action is valid
    const reason = basicValidation(client, player, clientMessage);
    if (reason !== null) {
        return sendRejection(
            client,
            {
                seq: clientMessage.seq,
                reason,
                // authoritativeState: snapshotPlayer(player) // e.g. previous player state
                authoritativeState: player,
            }
        );
    }

    // 2. update local gamestate
    const result = applyAction(player, clientMessage); // modify server world player state

    switch(result.reason) {
        case(null): 
            sendAck(client, {
                seq: result.seq,
                authoritativeState: player,
            });
            break;
        case("INVALID_KEY"): 
        case("INVALID_ACTION"): 
            sendRejection(client, {
                reason: result.reason,
                seq: result.seq,
                authoritativeState: player,
            });
            break;
        default:
            sendCorrection(client, {
                reason: result.reason,
                seq: result.seq,
                authoritativeState: player,
            });
    }

    // update checkpoint cache
    const checkpoint = checkpointService.toCheckpoint(player);
    checkpointService.update(checkpoint);

    // 4. update OTHER clients (e.g. send the player position update from local gamestate)
    dispatchMoveToOthers(clientId, player);
}

function dispatchMoveToOthers(clientId: string, player: Player) {
    const playerMove: ServerOtherPlayerMessage<"MOVE"> = {
        type: "PLAYER",
        subtype: "MOVE",
        playerId: player.id,
        pos: player.pos,
        dir: player.dir,
    };
    clients.forEach((client, key) => {
        if (key !== clientId) client.ws.send(JSON.stringify(playerMove));
    });
}


/**
 * assign playerId to client
 * load checkpoint, should exist
 * set into world
 * */
function handleInit(clientId: string, { playerId }: ClientInitMessage) {
    // // register the playerId
    const client = clients.get(clientId)!;
    client.reset();
    if (client.playerId) console.error('!!client already has playerId!!', client.playerId, {clientId, playerId});
    console.log(`assigning playerId ${playerId} to client: ${clientId}`);
    client.playerId = playerId;

    const checkpoint = checkpointService._loadCheckpoint(playerId); // default or existing
    console.assert(checkpoint, `!!No checkpoint found for playerId ${playerId}!!`);

    const init: ServerInitConfirmMessage = {
        type: "INIT",
        subtype: "CONFIRM",
        checkpoint,
        playerId,
    };
    client.ws.send(JSON.stringify(init));
}



function handleSave(clientId: string, { checkpoint: checkpointData, isClosing }: ClientCheckpointMessage<"SAVE">) {
    const client = clients.get(clientId)!;
    if (client.playerId !== checkpointData.playerId) return;

    checkpointService.update(checkpointData);

    if (isClosing) closeAfkPlayer(clientId);
}


