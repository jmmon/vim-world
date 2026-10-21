export type VimMode = "normal" | "operator" | "awaitingChar" | "command";
export type CommandVimActionType =
    | "COMMAND"
    | "COMMAND_PROMPT"
    | "COMMAND_PARTIAL"
    | "COMMAND_LINE";
export type VimActionType = "MOVE" | "INTERACT" | "TARGET" | CommandVimActionType;
export const COMMAND_ACTION_TYPES: CommandVimActionType[] = [
    "COMMAND",
    "COMMAND_PROMPT",
    "COMMAND_PARTIAL",
    "COMMAND_LINE",
];
/** command actions drive the command line, not the world */
export function isCommandAction(
    action: VimAction,
): action is CommandVimAction {
    return (COMMAND_ACTION_TYPES as string[]).includes(action.type);
}
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
export interface CommandVimAction extends VimAction {
    type: CommandVimActionType,
    command: string;
}
export interface ExpandedVimAction extends VimAction {
    remaining: number;
    seq: number;
    /** sequence this step belongs to, carried on partials whose seq is still the previous action's */
    finalSeq?: number;
    clientTime?: number;
}

export type TransitionResult = {
    state: VimFSMState | "__reset__";
    emit?: VimAction;
};

export type TransitionFn = (
    state: VimFSMState,
    event: KeyboardEvent,
    lastAction: null | VimAction,
) => TransitionResult;

