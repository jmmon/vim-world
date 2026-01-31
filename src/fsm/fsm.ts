import { QRL } from "@builder.io/qwik";
import { VimAction, VimFSMState } from "./types";
import { resetCtx, transitionTable } from "./transtionTable";

export type ActionFunction = (action: VimAction) => void | Promise<void>;
export class VimFSM {
    state: VimFSMState = {
        mode: "normal",
        buffer: [],
        count: null,
    };

    lastAction: VimAction | null = null;
    timeoutId: number | null = null;

    constructor(
        private onAction: ActionFunction | QRL<ActionFunction>,
        private timeoutMs = 1500,
    ) {}

    reset() {
        this.state = resetCtx();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    keyPress(event: KeyboardEvent, initialized = false) {
        if (!initialized) return;
        const { key, shiftKey, ctrlKey, altKey } = event;

        const ALLOW_BROWSER_HOTKEYS = [
            /** refresh */
            ctrlKey && key === 'r' || key === 'R',
            /** hard refresh */
            ctrlKey && shiftKey && key === 'r' || key === 'R',
            /** function keys */
            ...(Array.from({length: 12}, (_, i) => key === `<F${i + 1}>`)),
        ];
        if (ALLOW_BROWSER_HOTKEYS.some(Boolean)) return; // completely ignore these

        event.preventDefault(); // prevent browser default hotkeys

        // skip if modifier and no key
        const IGNORE_LIST = [
            (key === "Shift" && shiftKey),
            (key === "Control" && ctrlKey),
            (key === "Alt" && altKey),
        ]
        if (IGNORE_LIST.some(Boolean)) return;

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = window.setTimeout(this.reset, this.timeoutMs);

        const result = transitionTable[this.state.mode](
            this.state,
            event,
            this.lastAction,
        );
        if (result.state === "reset") {
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


