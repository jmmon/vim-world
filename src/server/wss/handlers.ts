import WebSocket from "ws";
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
    )
    console.log("Received ClientMessage:", message.toString());
};
export const onClose = (clientId: string) => () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
};
