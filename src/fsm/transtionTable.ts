import { VimFSMState, VimMode, TransitionFn } from "./types";

export function resetCtx(): VimFSMState {
    return {
        mode: "normal",
        buffer: [],
        count: null,
    };
}

export const transitionTable: Record<VimMode, TransitionFn> = {
    /* ---------------- NORMAL MODE ---------------- */
    normal(state, event, lastAction) {
        const key = event.key;
        if (key === '[' && event.ctrlKey) {
            // TODO: show some menu
            if (state.buffer.length > 0 || state.count !== null) {
                console.log('resetting state via ctrl+[')
                return {
                    state: 'reset',
                }
            }
            return {
                state,
                emit: {
                    type: 'COMMAND',
                    command: 'ctrl+[', // ok?
                }
            }
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

        if (["h", "j", "k", "l", "w", "b"].includes(key)) {
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

        if (key === "y" || key === "d" || key === "c") {
            return {
                state: {
                    mode: "operator",
                    operator: key,
                    buffer: [],
                    count: state.count,
                },
            };
        }

        if (key === "f" || key === "F" || key === "t" || key === "T" || key === 'g') {
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
        if (key === '[' && event.ctrlKey) {
            // cancel current command
            console.log('resetting state via ctrl+[')
            return {
                state: 'reset',
            }
        }

        if (key === "a" || key === "i") {
            return { state: { ...state, buffer: [...state.buffer, key] } };
        }

        if (key === "(" || key === `"`) {
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
        if (key === '[' && event.ctrlKey) {
            // cancel current command
            console.log('resetting state via ctrl+[')
            return {
                state: 'reset',
            }
        }
        const cmd = `${state.motion}${key}`;
        if (key === '?') {
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
        if (key === '[' && event.ctrlKey) {
            // cancel current command
            console.log('resetting state via ctrl+[')
            return {
                state: 'reset',
            }
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
