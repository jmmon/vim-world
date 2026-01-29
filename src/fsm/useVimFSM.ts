import {
    NoSerialize,
    QRL,
    Signal,
    $,
    noSerialize,
    useOnDocument,
    useSignal,
    useVisibleTask$,
} from "@builder.io/qwik";
import { GameAction } from "./types";
import { VimFSM } from "./fsm";

// wrapper around VimFSM class
const useVimFSM = (
    onAction: QRL<(a: GameAction) => void>,
    initialized: Signal<any>,
    timeoutMs = 1500,
) => {
    const fsm = useSignal<NoSerialize<VimFSM>>();

    const onKeyDown$ = $((event: KeyboardEvent) => {
        fsm.value?.keyPress(event, !!initialized.value);
    });
    useOnDocument("keydown", onKeyDown$);

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        console.log("initializing fsm");
        fsm.value ??= noSerialize(new VimFSM(onAction, timeoutMs));
    });

    return fsm;
};
export default useVimFSM;
