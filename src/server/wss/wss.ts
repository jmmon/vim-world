import { WebSocketServer } from "ws";
import { onClose, onConnect, onMessage } from "./handlers";

let _wss: WebSocketServer | null = null;

export type LagConfig = {
    /** base delay applied to every inbound frame, in ms */
    lagMs: number;
    /** random spread added on top of lagMs, in ms */
    jitterMs: number;
};

const NO_LAG: LagConfig = { lagMs: 0, jitterMs: 0 };

function resolveLag(lagMs: number, jitterMs: number): number {
    if (jitterMs <= 0) return lagMs;
    return lagMs + Math.random() * jitterMs;
}

export const initializeWss = (lag: Partial<LagConfig> = {}) => {
    const { lagMs, jitterMs } = { ...NO_LAG, ...lag };
    if (!_wss) {
        _wss = new WebSocketServer({ noServer: true }); // will integrate with Qwik server upgrade

        _wss.on("connection", (ws) => {
            // Client connect
            const id = onConnect(ws);

            // Client message
            // artificial lag for testing; off unless configured
            ws.on("message", (data) => {
                const handle = onMessage(id);
                if (lagMs <= 0 && jitterMs <= 0) return handle(data);
                const delay = resolveLag(lagMs, jitterMs);
                setTimeout(() => handle(data), delay);
            });

            // Client disconnect
            ws.on("close", onClose(id));
        });
    }
    return _wss;
};