import { NoSerialize, QRL,  Signal,  noSerialize, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { GameAction } from "./types";
import { VimFSM } from "./fsm";

// wrapper around VimFSM class
const useVimFSM = (
    onAction: QRL<(a: GameAction) => void>,
    initialized: Signal<any>,
    timeoutMs = 1500,
) => {
    const fsm = useSignal<NoSerialize<VimFSM>>();
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({cleanup}) => {
        fsm.value = noSerialize(new VimFSM(onAction, timeoutMs));
        const onKeyDown = (event: KeyboardEvent) => fsm.value?.keyPress(event, !!initialized.value);

        document.addEventListener("keydown", onKeyDown);
        cleanup(() => {
            document.removeEventListener("keydown", onKeyDown);
        });
    });

    return fsm;
};
export default useVimFSM;
