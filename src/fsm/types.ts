export type VimMode = "normal" | "operator" | "awaitingChar" | "command";

export interface VimFSMState {
    mode: VimMode;
    count: number | null;
    operator?: "y" | "d" | "c"; // more?
    motion?: string; // "f" | "F" // more?
    buffer: string[];
    lastAction?: VimAction;
}

export type VimActionType = "MOVE" | "INTERACT" | "TARGET" | "COMMAND";
export interface VimAction {
    type: VimActionType;
    key?: string;
    command?: string;
    count?: number;
}

export type TransitionResult = {
    state: VimFSMState | "reset";
    emit?: VimAction;
};

export type TransitionFn = (
    state: VimFSMState,
    event: KeyboardEvent,
    lastAction: null | VimAction,
) => TransitionResult;


