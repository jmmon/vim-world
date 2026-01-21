import WebSocket from "ws";
import {
    ClientMessage,
} from "~/fsm/types";
import { clients } from "../serverState";
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
