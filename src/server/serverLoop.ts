import { WORLD_WRAPPER, clients, serverhandlers } from "./serverState";
import { markAfkPlayer, startCloseAfkPlayer, terminateAfkPlayer } from "./wss/handleAfkDisconnect";
import { setupCallTicksForPlayer } from "~/simulation/shared/loop/loop";
import { getTickActionHandlerForPlayer } from "./wss/helpers";
import { message } from "./wss/ack";
import { ClientSession } from "./types";
import { ServerPlayer } from "~/types/worldTypes";
import { ReasonRejected } from "~/simulation/server/types";
import { ExpandedVimAction } from "~/fsm/types";
import checkpointService from "./checkpointService";
import { ActionResult } from "~/components/canvas1/types";

export let currentServerTick = 0;

export default function serverLoop() {
    console.log('started serverLoop');
    let before = Date.now();

    setInterval(() => {
        // TODO: some other loop to process actions...
        // // e.g. process one move action per tick from the player's action queue

        if (clients.size > 0) {
            // maybe these ought to be promises that are not awaited??
            // or should run faster after removing server logging
            connectionLoop(currentServerTick);
            serverTick();
        }
        const now = Date.now();
        const duration = now - before;
        console.assert(duration < 100, 'long tick::', duration);
        before = now;

        currentServerTick++;
    }, 50);
}


function connectionLoop(ticks: number) {
    // every 5 seconds
    if (ticks % 100 === 0) {
        Array.from(clients.entries()).forEach(([key, { isAfk }]) => {
            if (!isAfk) {
                markAfkPlayer(key);
            } else {
                startCloseAfkPlayer(key);
                terminateAfkPlayer(key);
            }
        });
    }
}

// once every 3 steps (but could get processed up to 3 times in one single tick in case of lag)
const setupAtTickEndForPlayer = (
    client: ClientSession,
    player: ServerPlayer
) => (
        reason: ActionResult['reason'] | ReasonRejected,
        action?: ExpandedVimAction,
    ) => {
        if (!action) return;
        if (reason !== undefined && action.remaining > 0) {
            player.lastProcessedSeq = Math.max(player.lastProcessedSeq, action.seq + 1); // update seq if breaking early
            // console.log('atTickEnd: broke early, incrementing seq to:', player.lastProcessedSeq);
        }

        // update checkpoint cache
        const checkpoint = checkpointService.toCheckpoint(player);
        checkpointService.update(checkpoint);

        message.ack.send(client, player, reason, action);
        message.playerMove(client.clientId, player);
    };


function serverTick() {
    const now = Date.now();
    for (const client of clients.values()) {
        if (!('playerId' in client)) return;

        const player = serverhandlers.getPlayerById(WORLD_WRAPPER, client.playerId);
        if (!player) return;

        client.callTicks ??= setupCallTicksForPlayer(
            WORLD_WRAPPER,
            player,
            getTickActionHandlerForPlayer(client, player),
            setupAtTickEndForPlayer(client, player)
        );

        client.callTicks(now, currentServerTick)
    }
    console.assert(Date.now() - now < 100, 'server tick slow!! 100ms!');
}


