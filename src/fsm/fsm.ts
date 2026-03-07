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
        private timeoutMs = 1000,
    ) {}

    reset() {
        this.state = resetCtx();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    isBrowserHotkey({key, shiftKey, ctrlKey}: KeyboardEvent) {
        /** refresh */
        return ctrlKey && key === 'r' || key === 'R' || 
        /** hard refresh */
        ctrlKey && shiftKey && key === 'r' || key === 'R' || 
        /** function keys */
        key[0] === 'F' && Number(key.slice(1)) >= 1 && Number(key.slice(1)) <= 12;
        // ...(Array.from({ length: 12 }, (_, i) => key === `F${i + 1}`)),
    };
    isIgnoredKey({key, shiftKey, ctrlKey, altKey}: KeyboardEvent) {
        return (key === "Shift" && shiftKey) || 
            (key === "Control" && ctrlKey) ||
            (key === "Alt" && altKey);
    }

    keyPress(event: KeyboardEvent, initialized = false) {
        if (!initialized) return;
        if (this.isBrowserHotkey(event)) return; // completely ignore these
        event.preventDefault(); // prevent browser default hotkeys
        // skip if modifier and no key
        if (this.isIgnoredKey(event)) return;

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


