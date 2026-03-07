import WebSocket from "ws";
import { WORLD_WRAPPER, clients, serverhandlers } from "../serverState";
import { ClientSession, ClientPlayerCacheData, ServerWorldWrapper } from "../types";
import { ServerPlayer } from "~/types/worldTypes";
import checkpointService from "../checkpointService";
import { message } from "./ack";
import { serverApplyAction } from "~/simulation/server/applyAction";
import { ExpandedVimAction } from "~/fsm/types";
import serverActionValidators from "~/simulation/server/validators";
import { ActionResult } from "~/components/canvas1/types";
import { logObj } from "~/utils/utils";

export const createClientData = (ws: WebSocket, clientId: string): ClientSession => ({
    clientId,
    ws,
    lastMessageTime: Date.now(),
    isAfk: false,
    playerId: undefined,
    /* reset client afk state */
    reset: function(this) {
        this.lastMessageTime = Date.now();
        this.isAfk = false;
    },
    disconnect: function(this) {
        this.ws.terminate();
        clients.delete(this.clientId);
    },
});


type ClientPlayerData = {
    client: ClientSession | ClientPlayerCacheData,
    player?: ServerPlayer,
}
// 1. confirm the action is valid - not in past, basic schema validation
// NOTE: should happen once per receive of message! not once per tick
export function getClientAndPlayer(clientId: string): false | ClientPlayerData  {
    const client = clients.get(clientId);
    if (!client) {
        console.error('!!no client found!!', clientId);
        return false;
    }
    client.reset();

    if (!hasPlayerId(client)) {
        console.error('!!client has no playerId!!', clientId);
        return { client };
    }

    const player = serverhandlers.getPlayerById(WORLD_WRAPPER, client.playerId);
    if (!player) {
        console.error('!!no player found for playerId:', client.playerId);
        return { client };
    }

    return {
        client,
        player
    };
}

export const hasPlayerId = (
    client: ClientSession | ClientPlayerCacheData
): client is ClientPlayerCacheData => 
    'playerId' in client;



export const getTickActionHandlerForPlayer = (
    client: ClientSession,
    player: ServerPlayer,
) => (
        ctx: ServerWorldWrapper,
        expandedAction: ExpandedVimAction,
        tick: number,
    ) => {
        const reasonValidity = serverActionValidators.basic(
            client,
            player,
            expandedAction
        );
        if (reasonValidity !== null) {
            // TODO: check this::
            player.lastProcessedSeq = Math.max(
                player.lastProcessedSeq,
                expandedAction.seq
            );
            return reasonValidity;
        }
        // modify server world player state
        const reason = serverApplyAction[expandedAction.type](
            ctx,
            player,
            expandedAction
        );

        console.log(`${
                reason ? "reason: " + reason + " " : ""
            }~~ at: tick: ${
                tick
            }, seq: ${
                expandedAction.seq
            }, action:`,
            logObj(expandedAction),
            ' playerName:',
            player.name
        );

        return reason;
    };

    // handleServerActionTick(ctx, client, player, action, tick);


// function handleServerActionTick(
//     ctx: ServerWorldWrapper,
//     client: ClientSession,
//     player: ServerPlayer,
//     expandedAction: ExpandedVimAction,
//     tick: number,
// ) 


