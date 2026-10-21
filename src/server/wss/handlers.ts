import WebSocket from "ws";
import {
    ClientActionMessage,
    ClientCheckpointMessage,
    ClientInitMessage,
    ClientMessage,
} from "~/types/wss/client";
import { WORLD_WRAPPER, clients } from "../serverState";
import checkpointService  from "../checkpointService";
import { ServerPlayer } from "~/types/worldTypes";
import { closeAfkPlayer } from "./handleAfkDisconnect";
import { expandAction } from "~/simulation/shared/loop/helpers";
import { MOVEMENT_CONFIG } from "~/simulation/shared/loop/loop";
import { createClientData, getClientAndPlayer, hasPlayerId } from "./helpers";
import { message as messenger } from "./ack";


export const onConnect = (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    clients.set(clientId, createClientData(ws, clientId));
    console.log("Client connected", clientId);
    return clientId;
};

export const onMessage = (clientId: string) => (message: WebSocket.RawData) => {
    let clientMessage: ClientMessage;
    try {
        const parsed = JSON.parse(message.toString());
        if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
            throw new Error('missing message type');
        }
        clientMessage = parsed as ClientMessage;
    } catch (err) {
        console.error('discarding malformed message', clientId, err);
        return;
    }

    const result = getClientAndPlayer(clientId);
    if (process.env.VIMWORLD_DEBUG === '1') console.log('onMessage::', {
        type: clientMessage.type,
        ...('subtype' in clientMessage ? {subtype: clientMessage?.subtype} : {}),
        ...('seq' in clientMessage ? {
            seq: clientMessage?.seq,
            action: clientMessage?.action,
        } : {}),
        ...('checkpoint' in clientMessage ? {checkpoint: clientMessage?.checkpoint} : {}),
        ...(result ? (
            'player' in result ? {
                playerDir: result.player?.dir,
                playerX: result.player?.pos.x,
                playerY: result.player?.pos.y,
            } : {}
        ) : {}),
    });

    switch(clientMessage.type) {
        case('INIT'):
            handleInit(clientId, clientMessage);
            break;
        case('ACTION'):
            if (result === false || !result.player) return;
            if (enqueueClientAction(result.player, clientMessage)) break;
            // queue is saturated: skip the action and tell the client it was dropped
            result.player.lastProcessedSeq = Math.max(
                result.player.lastProcessedSeq,
                clientMessage.seq,
            );
            messenger.ack.send(result.client, result.player, 'INVALID_ACTION', {
                ...clientMessage.action,
                remaining: 0,
                seq: clientMessage.seq,
                clientTime: clientMessage.clientTime,
            });
            break;
        case('CHECKPOINT'):
            if (clientMessage.subtype === 'SAVE') {
                handleSave(clientId, clientMessage as ClientCheckpointMessage<'SAVE'>);
            }
            break;
        case('LOGOUT'):
            handleSave(clientId, {...clientMessage, isClosing: true});
            break;
        default:
            console.log("UNHANDLED:: RECEIVED ClientMessage:", message.toString());
    }
};

// on ws message:
export function enqueueClientAction(
    player: Pick<ServerPlayer, 'lastProcessedSeq' | 'actionQueue'>,
    msg: ClientActionMessage
) {
    const steps = expandAction(msg, player.lastProcessedSeq);
    if (player.actionQueue.length + steps.length > MOVEMENT_CONFIG.maxQueuedSteps) {
        return false;
    }
    player.actionQueue.push(...steps);
    return true;
}


export const onClose = (clientId: string) => () => {
    const client = clients.get(clientId);
    if (!client) return;
    const playerId = client.playerId;
    if (playerId) WORLD_WRAPPER.world.players.delete(playerId);
    client.disconnect();
    clients.delete(clientId);

    console.log(`Client ${clientId} disconnected`);
};


// actually should queue the action to be processed by the tick loop
// async function handleServerAction(clientId: string, clientMessage: ClientActionMessage) {
//     const client = clients.get(clientId)!;
//     client.reset();
//     if (!hasPlayerId(client)) return console.error('!!client has no playerId!!');
//     // console.log('handleServerAction', clientMessage );
//     const player = WORLD_WRAPPER.world.players.get(client.playerId as string);
//     if (!player) return console.error('!!no player found for playerId:', client.playerId);
//     // TODO: find this player and apply to this player
//
//     // 1. confirm the action is valid
//     const reasonBasic = serverValidators.basic(client, player, clientMessage.action);
//     if (reasonBasic !== null) {
//         return ack.rejection(
//             client,
//             {
//                 seq: clientMessage.seq,
//                 reason: reasonBasic,
//                 // authoritativeState: snapshotPlayer(player) // e.g. previous player state
//                 authoritativeState: player,
//             }
//         );
//     }
//
//     // 2. validate specific action and update local gamestate
//     const reason = await applyActionToServerWorld(player, clientMessage.action); // modify server world player state
//
//     console.log(reason, ' ~~ at:', clientMessage.seq, ' action:', clientMessage.action, ' player:', player);
//
//     player.lastProcessedSeq = clientMessage.seq;
//
//     switch(reason) {
//         case(undefined): 
//             ack.valid(client, {
//                 seq: clientMessage.seq,
//                 authoritativeState: player,
//             });
//             break;
//         case("INVALID_KEY"): 
//         case("INVALID_ACTION"): 
//             ack.rejection(client, {
//                 reason: reason,
//                 seq: clientMessage.seq,
//                 authoritativeState: player,
//             });
//             break;
//         default:
//             ack.correction(client, {
//                 reason: reason,
//                 seq: clientMessage.seq,
//                 authoritativeState: player,
//             });
//     }
//
//     // update checkpoint cache
//     const checkpoint = checkpointService.toCheckpoint(player);
//     checkpointService.update(checkpoint);
//
//     // 4. update OTHER clients (e.g. send the player position update from local gamestate)
//     dispatchMoveToOthers(clientId, player);
// }


/**
 * assign playerId to client
 * load checkpoint, should exist
 * set into world
 * */
function handleInit(clientId: string, { playerId }: ClientInitMessage) {
    // register the playerId
    const client = clients.get(clientId)!;
    client.reset();

    if (hasPlayerId(client)) {
        console.error('!!client already has playerId!!', client.playerId, {clientId, playerId});
        if (client.playerId !== playerId) {
            console.log(`~~ replacing playerId ${playerId} to client: ${clientId}`);
            client.playerId = playerId;
        }
    } else {
        console.log(`assigning playerId ${playerId} to client: ${clientId}`);
        client.playerId = playerId;
    }

    const checkpoint = checkpointService._loadCheckpoint(playerId); // default or existing
    console.assert(checkpoint, `!!No checkpoint found for playerId ${playerId}!!`);

    messenger.ack.init(client, playerId, checkpoint);
}



function handleSave(clientId: string, { checkpoint, isClosing }: Pick<ClientCheckpointMessage<"SAVE">, 'checkpoint' | 'isClosing'>) {
    const client = clients.get(clientId)!;
    if (client.playerId !== checkpoint.playerId) return;

    const savedData = checkpointService.update(checkpoint);
    if (!!savedData) messenger.ack.checkpoint(client, savedData)
    if (isClosing) closeAfkPlayer(clientId);
}


