import { $, QRL, useSignal } from "@builder.io/qwik";
import { VimAction, VimFSMState } from "../../fsm/types";
import { classifyInput, transitionTable } from "./transitionTable2";
import { resetCtx } from "../../fsm/transtionTable";

export function useVimFsm2(onAction: QRL<(a: VimAction) => void>) {
    const TIMEOUT_MS = 1500;
    const state = useSignal<VimFSMState>({
        mode: "normal",
        count: 0,
        buffer: [],
    });

    const timeoutId = useSignal<number | null>(null);

    const reset = $(() => {
        state.value = resetCtx();
        if (timeoutId.value) {
            clearTimeout(timeoutId.value);
            timeoutId.value = null;
        }
    });

    const armTimeout = $(() => {
        if (timeoutId.value) clearTimeout(timeoutId.value);
        timeoutId.value = window.setTimeout(reset, TIMEOUT_MS);
    });

    const handleKey$ = $((event: KeyboardEvent) => {
        const key = event.key;
        if (key === "Shift" && event.shiftKey) return;
        armTimeout();

        const input = classifyInput(key);
        const transition = transitionTable[state.value.mode]?.[input];

        if (!transition) return;

        const action = transition.effect?.(state.value, key);
        state.value = { ...state.value, mode: transition.next };

        if (action) {
            onAction(action);
        }
    });

    return {
        state,
        handleKey$,
    };
}


