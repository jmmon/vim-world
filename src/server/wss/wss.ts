import { WebSocketServer } from "ws";
import { onClose, onConnect, onMessage } from "./handlers";

let _wss: WebSocketServer | null = null;

function delay<T extends () => void>(cb: T, ms: number) {
    return new Promise((res) => setTimeout(() => res(cb()), ms))
}

export const initializeWss = () => {
    if (!_wss) {
        _wss = new WebSocketServer({ noServer: true }); // will integrate with Qwik server upgrade

        _wss.on("connection", (ws) => {
            // Client connect
            const id = onConnect(ws);

            // Client message
            // ws.on("message", delay(() => onMessage(id), 50));
            ws.on("message", (ws) => delay(() => onMessage(id)(ws), 50));

            // Client disconnect
            ws.on("close", onClose(id));
        });
    }
    return _wss;
};


