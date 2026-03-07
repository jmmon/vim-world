import { QRL } from "@builder.io/qwik";
import { VimAction, VimFSMState } from "./types";
import { transitionTable } from "./transtionTable";

export type ActionFunction = (action: VimAction) => void | Promise<void>;

const INITIAL_STATE: VimFSMState = {
    mode: "normal",
    buffer: [],
    count: null,
};
export class VimFSM {
    state: VimFSMState = { ...INITIAL_STATE };

    lastAction: VimAction | null = null;
    timeoutId: number | ReturnType<typeof setTimeout> | null = null;

    constructor(
        private onAction: ActionFunction | QRL<ActionFunction>,
        private timeoutMs = 1000,
    ) {}

    reset() {
        this.state = { ...INITIAL_STATE };
    }

    shouldBrowserHandle({ key, ctrlKey }: KeyboardEvent) {
        const rest = key.slice(1);
        return (
            /** refresh */
            /** hard refresh */
            (ctrlKey && (key === "r" || key === "R")) ||
            /** function keys */
            (key[0] === "F" && Number(rest) >= 1 && Number(rest) <= 12)
        );
    }

    shouldIgnore(e: KeyboardEvent) {
        return (
            (e.key === "Shift" && e.shiftKey) ||
            (e.key === "Control" && e.ctrlKey) ||
            (e.key === "Alt" && e.altKey) ||
            this.shouldBrowserHandle(e)
        );
    }

    keyPress(event: KeyboardEvent, initialized = false) {
        if (!initialized) return;
        if (this.shouldIgnore(event)) return;
        event.preventDefault();

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = window.setTimeout(
            this.reset.bind(this),
            this.timeoutMs,
        );

        const result = transitionTable[this.state.mode](
            this.state,
            event,
            this.lastAction,
        );
        if (result.state === "__reset__") {
            this.reset();
        } else {
            this.state = result.state;
        }

        if (result?.emit) {
            this.lastAction = result.emit;
            this.onAction(result.emit);
        }
    }
}
