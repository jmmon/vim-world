import { NoSerialize, QRL, noSerialize, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { API_PORT } from "./constants";

export const useWebSocket = (
    onMessage: QRL<(ws: NoSerialize<WebSocket>, data: any) => any>, 
    onInit: QRL<(ws: NoSerialize<WebSocket>) => any>,
    opts = {
        url: `ws://localhost:${API_PORT}/ws`,
    }
) => {
    const ws = useSignal<NoSerialize<WebSocket> | null>(null);

    //eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        if (!ws.value) ws.value = noSerialize(new WebSocket(opts.url));

        ws.value!.onopen = () => {
            console.log("Connected via websocket!")
            onInit(ws.value!);
        };
        ws.value!.onmessage = (event) => {
            // Update player or other players
            onMessage(ws.value!, event);
        };
    })

    return ws;
}
export default useWebSocket;

