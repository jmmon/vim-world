import { QRL, $, useSignal } from "@builder.io/qwik";

type Mode = "normal" | "operator" | "awaitingChar" | "command";

export type ActionHandler = (action: { type: "MOVE" | "INTERACT" | "TARGET" | "COMMAND"; command?: string; key?: string }) => void;

interface VimState {
    mode: Mode;
    operator?: "y" | "d" | "c";
    motion?: string;
    count?: string;
    buffer: string[];
    timeoutId?: ReturnType<typeof setTimeout>;
}

const MOVEMENT_KEYS = ["h", "j", "k", "l", "w", "b"];
const OPERATOR_KEYS = ["y", "d", "c"];
const AWAITING_CHAR_KEYS = ["f", "F"];
const COMMAND_KEYS = [":"];
const QUALIFIER_KEYS = ["i", "a"];
const INTERACT_KEYS = ["(", ")", "'", "\""];
const DIGIT_REGEX = /\d+/;

export class VimClientFSM {
    state: VimState = { mode: "normal", buffer: [] };

    constructor(
        private onAction: ActionHandler,
    ) {

        console.log('constructor runs')
    }

    keyPress(event: KeyboardEvent) {
        console.log('keypress runs')
        const key = event.key;
        const isShiftPressed = event.shiftKey;
        if (isShiftPressed && key === 'Shift') return;
        // Clear any previous timeout
        if (this.state.timeoutId) clearTimeout(this.state.timeoutId);


        // Set timeout to reset state after 1.5s of inactivity
        this.state.timeoutId = setTimeout(() => this.reset(), 1500);

        switch (this.state.mode) {
            case "normal":
                if (MOVEMENT_KEYS.includes(key)) {
                    this.onAction({ type: "MOVE", key });
                } else if (OPERATOR_KEYS.includes(key)) {
                    this.state.mode = "operator";
                    this.state.operator = key as "y" | "d" | "c";
                } else if (AWAITING_CHAR_KEYS.includes(key)) {
                    this.state.mode = "awaitingChar";
                    this.state.motion = key;
                } else if (COMMAND_KEYS.includes(key)) {
                    this.state.mode = "command";
                    this.state.buffer = [];
                }
                break;

            case "operator":
                // Expecting a motion or target
                if (QUALIFIER_KEYS.includes(key)) {
                    this.state.buffer.push(key);
                } else if (INTERACT_KEYS.includes(key)) {
                    const fullCommand = `${this.state.operator}${this.state.buffer.join("")}${key}`;
                    this.onAction({ type: "INTERACT", command: fullCommand });
                    this.reset();
                }
                break;

            case "awaitingChar":{

                const command = `${this.state.motion}${key}`;
                this.onAction({ type: "TARGET", command });
                this.reset();
                break;
            }

            case "command":
                if (key === "Enter") {
                    const cmd = this.state.buffer.join("");
                    this.onAction({ type: "COMMAND", command: cmd });
                    this.reset();
                } else {
                    this.state.buffer.push(key);
                }
                break;
        }
    }

    reset() {
        this.state = { mode: "normal", buffer: [] };
    }
}



export function useFSM(onAction: QRL<ActionHandler>) {
    const state = useSignal<VimState>({ mode: "normal", buffer: [] });


    const reset = $(() => {
        state.value = { mode: "normal", buffer: [] };
    });

    const keyPress = $((event: KeyboardEvent) => {
        const key = event.key;
        if (event.shiftKey && key === 'Shift' || event.altKey && key === 'Alt' || event.ctrlKey && key === 'Control') return;
        // Clear any previous timeout
        if (state.value.timeoutId) clearTimeout(state.value.timeoutId);

        // Set timeout to reset state after 1.5s of inactivity
        state.value.timeoutId = setTimeout(() => reset(), 1500);

        const keyLowerCase = key.toLowerCase();
        switch (state.value.mode) {
            case "normal":
                if (DIGIT_REGEX.test(keyLowerCase)) {
                    state.value.count ??='';
                    state.value.count += key;
                } else if (MOVEMENT_KEYS.includes(keyLowerCase)) {
                    const keyValue = (state.value.count ?? '') + key;
                    console.log({keyValue});
                    onAction({ type: "MOVE", key: keyValue });
                    state.value.count = undefined;
                } else if (OPERATOR_KEYS.includes(keyLowerCase)) {
                    state.value.mode = "operator";
                    state.value.operator = key as "y" | "d" | "c";
                } else if (AWAITING_CHAR_KEYS.includes(keyLowerCase)) {
                    state.value.mode = "awaitingChar";
                    state.value.motion = key;
                } else if (COMMAND_KEYS.includes(keyLowerCase)) {
                    state.value.mode = "command";
                    state.value.buffer = [];
                }
                break;

            case "operator":
                // Expecting a motion or target
                if (QUALIFIER_KEYS.includes(keyLowerCase)) {
                    state.value.buffer.push(key);
                } else if (INTERACT_KEYS.includes(keyLowerCase)) {
                    const fullCommand = `${state.value.operator}${state.value.buffer.join("")}${key}`;
                    onAction({ type: "INTERACT", command: fullCommand });
                    reset();
                }
                break;

            case "awaitingChar":{
                const command = `${state.value.motion}${key}`;
                onAction({ type: "TARGET", command });
                reset();
                break;
            }

            case "command":
                if (key === "Enter") {
                    const cmd = state.value.buffer.join("");
                    onAction({ type: "COMMAND", command: cmd });
                    reset();
                } else {
                    state.value.buffer.push(key);
                }
                break;
        }
    });

    return {
        keyPress,
        reset
    };
}

export type MoveDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
export const KEY_TO_ACTION_MAP = {
    MOVE: {
        h: 'LEFT',
        j: 'DOWN',
        k: 'UP',
        l: 'RIGHT',
        w: 'RIGHT',
        b: 'LEFT'
    } as Record<'h' | 'j' | 'k' | 'l' | 'w' | 'b', MoveDirection>,
    INTERACT: {

    },
    TARGET: {
        f: 'RIGHT',
        F: 'LEFT'

    },
    COMMAND: {

    },
}
