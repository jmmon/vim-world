import { NoSerialize, QRL, $, Signal, isServer, noSerialize, useOnWindow, useSignal, useTask$ } from "@builder.io/qwik";
import { wsOrigin } from "~/services/origin";
import { GameState } from "../useState";

export const useWebSocket = (
    state: GameState,
    onMessage: QRL<(data: any) => any>, 
    onOpen: QRL<() => any>,
    ws: Signal<NoSerialize<WebSocket>>,
    opts?: {
        url?: string;
    },
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

    // the socket connects as soon as the page loads, so we can watch the
    // other players move before we identify ourselves: the server only
    // needs to know who we are once we send an action
    // eagerness 'load' runs this in the browser when the app resumes
    useTask$(({ cleanup }) => {
        if (isServer) {
            isStartingInBrowser.value = true
            return;
        }
        console.log('~~ opening websocket connection...');

        // resolved here, not in the parameter list: the component renders on
        // the server, and a default value would be captured at render time
        const url = opts?.url ?? `${wsOrigin()}/ws`;
        if (!ws.value || isStartingInBrowser.value) ws.value = noSerialize(new WebSocket(url));
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
    }, { eagerness: 'load' });
}


