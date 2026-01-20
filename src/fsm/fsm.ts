import { QRL } from "@builder.io/qwik";
import { GameAction, VimFSMState } from "./types";
import { resetCtx, transitionTable } from "./transtionTable";

export type ActionFunction = (action: GameAction) => void | Promise<void>;
export class VimFSM {
    state: VimFSMState = {
        mode: "normal",
        buffer: [],
        count: null,
    };

    lastAction: GameAction | null = null;
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

    keyPress(event: KeyboardEvent) {
        const key = event.key;
        if (key === "Shift" && event.shiftKey) return;

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = window.setTimeout(this.reset, this.timeoutMs);

        const result = transitionTable[this.state.mode](
            this.state,
            key,
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

