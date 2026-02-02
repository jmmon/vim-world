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
import { VimAction } from "../fsm/types";
import { VimFSM } from "../fsm/fsm";
import { LocalWorldWrapper } from "~/components/canvas1/types";

// wrapper around VimFSM class
const useVimFSM = (
    onAction: QRL<(a: VimAction) => void>,
    initialized: Signal<any>,
    state: LocalWorldWrapper,
    timeoutMs = 1500,
) => {
    const fsm = useSignal<NoSerialize<VimFSM>>();

    const onKeyDown$ = $((event: KeyboardEvent) => {
        if (state.show.menu) return;
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


