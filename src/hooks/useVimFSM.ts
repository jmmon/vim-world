import {
    QRL,
    $,
    noSerialize,
    useOnDocument,
    useVisibleTask$,
} from "@builder.io/qwik";
import { VimAction } from "../fsm/types";
import { VimFSM } from "../fsm/fsm";
import { LocalWorldWrapper } from "~/components/canvas1/types";

/** =======================================================
 *          keyboard actions; apply to world
 * ======================================================= */
const useVimFSM = (
    onAction: QRL<(a: VimAction) => void>,
    ctx: LocalWorldWrapper,
    timeoutMs = 1500,
) => {
    const onKeyDown$ = $((event: KeyboardEvent) => {
        ctx.client.fsm?.keyPress(event, !!ctx.client.isReady);
    });
    useOnDocument("keydown", onKeyDown$);

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        console.log("initializing fsm...");
        ctx.client.fsm ??= noSerialize(new VimFSM(onAction, timeoutMs));
    });
};
export default useVimFSM;


