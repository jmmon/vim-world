import { WebSocketServer } from "ws";
import { onClose, onConnect, onMessage } from "./handlers";

let _wss: WebSocketServer | null = null;

export const initializeWss = () => {
    if (!_wss) {
        _wss = new WebSocketServer({ noServer: true }); // will integrate with Qwik server upgrade

        _wss.on("connection", (ws) => {
            // Client connect
            const id = onConnect(ws);

            // Client message
            ws.on("message", onMessage(id));

            // Client disconnect
            ws.on("close", onClose(id));
        });
    }
    return _wss;
};

