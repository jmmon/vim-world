import {
    VimFSMState,
    VimMode,
    TransitionFn,
    OperatorKey,
    AwaitingCharKey,
    MovementKey,
    ModifierKey,
    TargetKey,
} from "./types";

export function resetCtx(): VimFSMState {
    return {
        mode: "normal",
        buffer: [],
        count: null,
    };
}

export const MOVEMENT_KEYS: MovementKey[] = ["h", "j", "k", "l", "w", "b"];
export const AWAITING_CHAR_KEYS: AwaitingCharKey[] = ["f", "F", "t", "T", "g"];
export const OPERATOR_KEYS: OperatorKey[] = ["y", "d", "c", "p"];
export const MODIFIER_KEYS: ModifierKey[] = ["a", "i"];
export const VALID_YANK_PASTE_TARGETS: TargetKey[] = [
    "[",
    "]",
    "{",
    "}",
    "(",
    ")",
    "<",
    ">",
    '"',
    "'",
    "`",
];

export const transitionTable: Record<VimMode, TransitionFn> = {
    /* ---------------- NORMAL MODE ---------------- */
    normal(state, event, lastAction) {
        const key = event.key;
        if (key === "[" && event.ctrlKey) {
            // TODO: show some menu
            if (state.buffer.length > 0 || state.count !== null) {
                return {
                    state: "reset",
                };
            }
            return {
                state,
                emit: {
                    type: "COMMAND",
                    command: "ctrl+[",
                },
            };
        }

        // Handle counts
        if (/^[0-9]$/.test(key)) {
            const digit = Number(key);
            return {
                state: {
                    ...state,
                    count: (state.count ?? 0) * 10 + digit,
                },
            };
        }

        // Repeat last action
        if (key === "." && lastAction) {
            return {
                state: {
                    ...state,
                    count: lastAction.count ?? 1,
                },
                emit: lastAction,
            };
        }

        if (MOVEMENT_KEYS.includes(key as MovementKey)) {
            const count = state.count ?? 1;
            return {
                state: "reset",
                emit: {
                    type: "MOVE",
                    key,
                    count,
                },
            };
        }

        if (OPERATOR_KEYS.includes(key as OperatorKey)) {
            return {
                state: {
                    mode: "operator",
                    count: state.count,
                    buffer: [],
                    operator: key as OperatorKey,
                },
            };
        }

        if (AWAITING_CHAR_KEYS.includes(key as AwaitingCharKey)) {
            return {
                state: {
                    mode: "awaitingChar",
                    motion: key,
                    buffer: [],
                    count: state.count,
                },
            };
        }

        if (key === ":") {
            return {
                state: {
                    mode: "command",
                    buffer: [],
                    count: null,
                },
            };
        }

        return { state };
    },

    /* ---------------- OPERATOR MODE ---------------- */
    operator(state, event) {
        const key = event.key;
        if (key === "[" && event.ctrlKey) {
            // cancel current command
            return {
                state: "reset",
            };
        }

        if (MODIFIER_KEYS.includes(key as ModifierKey)) {
            return { state: { ...state, buffer: [...state.buffer, key] } };
        }

        if (VALID_YANK_PASTE_TARGETS.includes(key as TargetKey)) {
            const cmd = `${state.operator}${state.buffer.join("")}${key}`;
            return {
                state: "reset",
                emit: {
                    type: "INTERACT",
                    command: cmd,
                    count: state.count ?? 1,
                },
            };
        }

        return { state: "reset" };
    },

    /* ---------------- AWAITING CHAR ---------------- */
    awaitingChar(state, event) {
        const key = event.key;
        if (key === "[" && event.ctrlKey) {
            // cancel current command
            return {
                state: "reset",
            };
        }
        const cmd = `${state.motion}${key}`;
        if (key === "?") {
            return {
                state: "reset",
                emit: {
                    type: "COMMAND",
                    command: cmd,
                },
            };
        }

        return {
            state: "reset",
            emit: {
                type: "TARGET",
                command: cmd,
                count: state.count ?? 1,
            },
        };
    },

    /* ---------------- COMMAND MODE ---------------- */
    command(state, event) {
        const key = event.key;
        if (key === "[" && event.ctrlKey) {
            // cancel current command
            return {
                state: "reset",
            };
        }

        if (key === "Enter") {
            return {
                state: "reset",
                emit: {
                    type: "COMMAND",
                    command: state.buffer.join(""),
                },
            };
        }

        // add command keys to buffer
        return {
            state: { ...state, buffer: [...state.buffer, key] },
        };
    },
};
