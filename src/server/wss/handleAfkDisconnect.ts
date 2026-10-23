import { ServerAfkMessage, ServerConnectionMessage } from "~/types/wss/server";

import { clients } from "../serverState";
import { removeClient } from "./handlers";

export type AfkTimings = {
    /** idle time before the client is warned */
    afkMs: number;
    /** idle time before the server asks it to checkpoint and close */
    disconnectMs: number;
    /** grace period after the close request before the socket is killed */
    terminateMs: number;
    /** reads the clock, injectable so the ladder can be driven in tests */
    now: () => number;
};

const DEFAULT_TIMINGS: AfkTimings = {
    afkMs: 1 * 60 * 1000,
    disconnectMs: 2 * 60 * 1000,
    terminateMs: 10 * 1000, // 10s
    now: () => Date.now(),
};

let timings: AfkTimings = { ...DEFAULT_TIMINGS };

/** override the ladder timings; returns a reset for teardown */
export function configureAfkTimings(
    overrides: Partial<AfkTimings> = {},
): () => void {
    timings = { ...DEFAULT_TIMINGS, ...overrides };
    return () => {
        timings = { ...DEFAULT_TIMINGS };
    };
}

function idleFor(clientId: string): number | undefined {
    const client = clients.get(clientId);
    if (!client) return undefined;
    return timings.now() - client.lastMessageTime;
}

/**
 * a socket that never sent an init is watching the world without playing:
 * it holds no player, so it has nothing to checkpoint and the afk ladder
 * does not apply to it
 * */
function isSpectator(clientId: string): boolean {
    const client = clients.get(clientId);
    return !client || !client.playerId;
}

export function markAfkPlayer(clientId: string) {
    if (isSpectator(clientId)) return;
    const idle = idleFor(clientId);
    if (idle === undefined || idle <= timings.afkMs) return;

    const client = clients.get(clientId)!;

    const msg: ServerAfkMessage = { type: 'AFK' };
    client.ws.send(JSON.stringify(msg));
    console.log('~~ markAfkPlayer:', clientId);
    client.isAfk = true;
}


export function startCloseAfkPlayer(clientId: string) {
    if (isSpectator(clientId)) return;
    const idle = idleFor(clientId);
    if (idle === undefined || idle <= timings.disconnectMs) return;

    const client = clients.get(clientId)!;
    const msg: ServerConnectionMessage<"START"> = { type: "CLOSE", subtype: "START" };
    client.ws.send(JSON.stringify(msg)); // client will then send a checkpoint
    console.log('~~ startCloseAfkPlayer:', clientId);
}

export function closeAfkPlayer(clientId: string) {
    const client = clients.get(clientId);
    console.log('~~ closeAfkPlayer:', clientId);
    if (!client) return;
    const msg: ServerConnectionMessage = { type: 'CLOSE' };
    client.ws.send(JSON.stringify(msg));
    client.ws.close();
}

const OPEN_STATES = [WebSocket.OPEN, WebSocket.CLOSING];
export function terminateAfkPlayer(clientId: string) {
    if (isSpectator(clientId)) return;
    const idle = idleFor(clientId);
    if (idle === undefined || idle <= timings.disconnectMs + timings.terminateMs) return;

    const client = clients.get(clientId)!;

    if (OPEN_STATES.includes(client.ws.readyState)) {
        const msg: ServerConnectionMessage<'END'> = { type: "CLOSE", subtype: "END" };
        client.ws.send(JSON.stringify(msg));
        client.ws.terminate();
        // remove through the shared path so the other clients are told;
        // terminate means no close event will reach onClose
        removeClient(clientId);
        console.log('~~ terminateAfkPlayer:', clientId);
    }
}