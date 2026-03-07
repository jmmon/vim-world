import { NoSerialize, QRL, $, Signal, isServer, noSerialize, useOnWindow, useSignal, useTask$ } from "@builder.io/qwik";
import { API_PORT } from "~/server/constants";
import { GameState } from "../useState";

export const useWebSocket = (
    state: GameState,
    onMessage: QRL<(data: any) => any>, 
    onOpen: QRL<() => any>,
    ws: Signal<NoSerialize<WebSocket>>,
    opts = {
        url: `ws://localhost:${API_PORT}/ws`,
    }
) => {
    const isStartingInBrowser = useSignal(false);

    const cleanup$ = $(() => {
        console.log('~~ ws cleanup runs')
        if (ws.value) {
            ws.value.close();
            ws.value = undefined;
        }
        state.ctx.client.isReady = false;
        isStartingInBrowser.value = true;
    });

    useOnWindow('beforeunload', cleanup$);

    useTask$(({ track, cleanup }) => {
        const _isReady = !!track(() => state.ctx.client.isReady);
        if (isServer) {
            isStartingInBrowser.value = true
            return;
        }
        console.log('useWebSocket task runs:', {
            isReady: _isReady, ws: ws.value, isStartingInBrowser: isStartingInBrowser.value
        });
        if (!_isReady) return;
        console.log('~~ player ready! initializing connection...');

        if (!ws.value || isStartingInBrowser.value) ws.value = noSerialize(new WebSocket(opts.url));
        isStartingInBrowser.value = false;
        ws.value!.onopen = () => {
            console.log("Connected via websocket!")
            onOpen();
        };
        ws.value!.onmessage = (event) => {
            // Update player or other players
            onMessage(event);
        };
        cleanup(() => {
            cleanup$();
        })
    });
}


