import { NoSerialize, QRL, $, Signal, isServer, noSerialize, useOnWindow, useSignal, useTask$ } from "@builder.io/qwik";
import { API_PORT } from "../../components/canvas1/constants";

export const useWebSocket = (
    initializeTrigger: Signal<any>,
    onMessage: QRL<(data: any) => any>, 
    onOpen: QRL<() => any>,
    ws: Signal<NoSerialize<WebSocket>>,
    opts = {
        url: `ws://localhost:${API_PORT}/ws`,
    }
) => {
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
            onOpen();
        };
        ws.value!.onmessage = (event) => {
            // Update player or other players
            onMessage(event);
        };
        cleanup(() => {
            console.log('useWebSocket cleanup!!');
            cleanup$();
        })
    });
}


