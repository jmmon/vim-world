import { $, NoSerialize, Signal } from "@builder.io/qwik";
import { dispatch } from "./useWebSocket";
import { Player } from "~/types/worldTypes";
import { VimAction } from "~/fsm/types";

export default function useDispatch(ws: Signal<NoSerialize<WebSocket>>) {
    return {
        init: $((playerId: string) => {
            dispatch.init(ws.value, playerId);
        }),
        action: $((seq: number, action: VimAction) => {
            dispatch.action(ws.value!, seq, action);
        }),
        checkpoint: $((player: Player, isClosing?: boolean) => {
            dispatch.checkpoint(ws.value!, player, isClosing);
        }),
    };
}
