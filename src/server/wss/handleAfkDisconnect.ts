import { ServerAfkMessage, ServerConnectionMessage } from "~/types/messageTypes";
import { clients } from "../serverState";


const AFK_TIME = 1 * 60 * 1000;
const DISCONNECT_TIME = 2 * 60 * 1000;
const TERMINATE_TIME = 10 * 1000; // 10s


function hasTimePassed(clientId: string, time: number) {
    if (!clients.has(clientId)) return false;
    return Date.now() > (clients.get(clientId)!.lastMessageTime + time);
}
export function markAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, AFK_TIME)) return;

    const client = clients.get(clientId)!;

    const msg: ServerAfkMessage = { type: 'AFK' };
    client.ws.send(JSON.stringify(msg));
    console.log('~~ markAfkPlayer:', clientId);
    client.isAfk = true;
}


export function startCloseAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, DISCONNECT_TIME)) return;

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

export function terminateAfkPlayer(clientId: string) {
    if (!hasTimePassed(clientId, DISCONNECT_TIME + TERMINATE_TIME)) return;

    const client = clients.get(clientId)!;

    if ([client.ws.OPEN, client.ws.CLOSING].includes(client.ws.readyState)) {
        const msg: ServerConnectionMessage<'END'> = { type: "CLOSE", subtype: "END" };
        client.ws.send(JSON.stringify(msg));
        client.ws.terminate();
        clients.delete(clientId);
        console.log('~~ terminateAfkPlayer:', clientId);
    }
}


