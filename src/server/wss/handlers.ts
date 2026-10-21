import WebSocket from "ws";
import {
    ClientActionMessage,
    ClientCheckpointMessage,
    ClientInitMessage,
    ClientMessage,
} from "~/types/wss/client";
import { WORLD_WRAPPER, clients, serverhandlers } from "../serverState";
import checkpointService  from "../checkpointService";
import { ServerPlayer } from "~/types/worldTypes";
import { closeAfkPlayer } from "./handleAfkDisconnect";
import { expandAction } from "~/simulation/shared/loop/helpers";
import { MOVEMENT_CONFIG } from "~/simulation/shared/loop/loop";
import { createClientData, getClientAndPlayer, hasPlayerId } from "./helpers";
import { message as messenger } from "./ack";
import serverValidators from "~/simulation/server/validators";
import { ExpandedVimAction } from "~/fsm/types";


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
            {
                const { client, player } = result;
                const receivedAction: ExpandedVimAction = {
                    ...clientMessage.action,
                    remaining: 0,
                    seq: clientMessage.seq,
                    clientTime: clientMessage.clientTime,
                };
                // validate once per message, before it reaches the queue
                const reason = serverValidators.basic(client, player, receivedAction);
                if (reason !== null || !enqueueClientAction(player, clientMessage)) {
                    // advance the sequence so the client stops predicting the
                    // action we are refusing to run
                    player.lastProcessedSeq = Math.max(
                        player.lastProcessedSeq,
                        clientMessage.seq,
                    );
                    messenger.ack.send(
                        client,
                        player,
                        reason ?? 'INVALID_ACTION',
                        receivedAction,
                    );
                }
            }
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


/**
 * take a client out of the world and tell the others to stop rendering it;
 * used by both the socket close path and the afk terminate path, which
 * removes the client without waiting for a close event
 * */
export function removeClient(clientId: string) {
    const client = clients.get(clientId);
    if (!client) return;
    const playerId = client.playerId;
    if (!playerId) return;
    WORLD_WRAPPER.world.players.delete(playerId);
    messenger.playerDisconnect(clientId, playerId);
    clients.delete(clientId);
}


export const onClose = (clientId: string) => () => {
    const client = clients.get(clientId);
    if (!client) return;
    removeClient(clientId);
    client.disconnect();

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
/**
 * a player is only ever driven by one session: a reconnecting browser
 * still has the previous socket alive briefly, and two sessions acting on
 * the same player would race each other's acks
 *
 * the player stays in the world, since the incoming session takes over
 * from the one being retired
 * */
function kickOtherSessions(playerId: string, keepClientId: string) {
    for (const client of Array.from(clients.values())) {
        if (client.clientId === keepClientId) continue;
        if (client.playerId !== playerId) continue;

        console.log(
            `kicking stale session ${client.clientId} for playerId ${playerId}`,
        );
        messenger.playerDisconnect(client.clientId, playerId);
        clients.delete(client.clientId);
        client.ws.send(JSON.stringify({ type: "CLOSE" }));
        client.ws.close();
    }
}

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

    // drop any older session still holding this player before announcing ours
    kickOtherSessions(playerId, clientId);

    const checkpoint = checkpointService._loadCheckpoint(playerId); // default or existing
    console.assert(checkpoint, `!!No checkpoint found for playerId ${playerId}!!`);

    messenger.ack.init(client, playerId, checkpoint);

    // let the other clients render this player
    const player = serverhandlers.getPlayerById(WORLD_WRAPPER, playerId);
    if (player) messenger.playerConnect(clientId, player);
}



function handleSave(clientId: string, { checkpoint, isClosing }: Pick<ClientCheckpointMessage<"SAVE">, 'checkpoint' | 'isClosing'>) {
    const client = clients.get(clientId)!;
    if (client.playerId !== checkpoint.playerId) return;

    const savedData = checkpointService.update(checkpoint);
    if (!!savedData) messenger.ack.checkpoint(client, savedData)
    if (isClosing) closeAfkPlayer(clientId);
}


