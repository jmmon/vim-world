export type VimMode = "normal" | "operator" | "awaitingChar" | "command";
export type VimActionType = "MOVE" | "INTERACT" | "TARGET" | "COMMAND" | "COMMAND_PROMPT" | "COMMAND_PARTIAL";
export type OperatorKey = "y" | "d" | "c" | "p";
export type AwaitingCharKey = "f" | "F" | "t" | "T" | "g";
export type MovementKey = "h" | "j" | "k" | "l" | "w" | "b";
export type ModifierKey = "a" | "i";
export type TargetKey =
    | "["
    | "]"
    | "{"
    | "}"
    | "("
    | ")"
    | "<"
    | ">"
    | '"'
    | "'"
    | "`";

export interface VimFSMState {
    mode: VimMode;
    count: number | null;
    buffer: string[];
    operator?: OperatorKey; // more?
    motion?: string; // "f" | "F" // more?
    lastAction?: VimAction;
}

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
