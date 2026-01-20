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
    normal(state, key, lastAction) {
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

        if (key === "f" || key === "F" || key === "t" || key === "T") {
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
    operator(state, key) {
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
    awaitingChar(state, key) {
        const cmd = `${state.motion}${key}`;
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
    command(state, key) {
        if (key === "Enter") {
            return {
                state: "reset",
                emit: {
                    type: "COMMAND",
                    command: state.buffer.join(""),
                },
            };
        }

        return {
            state: { ...state, buffer: [...state.buffer, key] },
        };
    },
};
