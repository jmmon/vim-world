import { NoSerialize, QRL, $, Signal, isServer, noSerialize, useOnWindow, useSignal, useTask$ } from "@builder.io/qwik";
import { API_PORT } from "../../components/canvas1/constants";

export const useWebSocket = (
    initializeTrigger: Signal<any>,
    onMessage: QRL<(ws: NoSerialize<WebSocket>, data: any) => any>, 
    onOpen: QRL<(ws: NoSerialize<WebSocket>) => any>,
    opts = {
        url: `ws://localhost:${API_PORT}/ws`,
    }
) => {
    const ws = useSignal<NoSerialize<WebSocket>>();
    const isStartingInBrowser = useSignal(false);

    const cleanup$ = $(() => {
        console.log('~~ and beforeUnload')
        if (ws.value) {
            ws.value.close();
            ws.value = undefined;
        }
        initializeTrigger.value = false;
        isStartingInBrowser.value = true;
    });

    useOnWindow('beforeunload', cleanup$);

    useTask$(({ track, cleanup }) => {
        const isReady = !!track(initializeTrigger);
        if (isServer) {
            isStartingInBrowser.value = true
            return;
        }
        console.log('useWebSocket task runs:', { isReady, ws: ws.value, isStartingInBrowser: isStartingInBrowser.value });
        if (!isReady) return;

        if (!ws.value || isStartingInBrowser.value) ws.value = noSerialize(new WebSocket(opts.url));
        isStartingInBrowser.value = false;
        ws.value!.onopen = () => {
            console.log("Connected via websocket!")
            onOpen(ws.value!);
        };
        ws.value!.onmessage = (event) => {
            // Update player or other players
            onMessage(ws.value!, event);
        };
        cleanup(() => {
            console.log('useWebSocket cleanup!!');
            cleanup$();
        })
    });

    return ws;
}


