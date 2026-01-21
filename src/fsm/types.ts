import { Player, Vec2 } from "~/components/canvas1/types";

export type VimMode = "normal" | "operator" | "awaitingChar" | "command";

export interface VimFSMState {
    mode: VimMode;
    count: number | null;
    operator?: "y" | "d" | "c"; // more?
    motion?: string; // "f" | "F" // more?
    buffer: string[];
    lastAction?: GameAction;
}

// for 2
export type InputType =
    | "digit"
    | "move"
    | "operator"
    | "motion"
    | "scope"
    // | "delimiter"
    | "repeat"
    | "commandStart"
    | "enter"
    | "char"
    | "unknown";

// for 2
export type Input =
    | { kind: "digit"; value: number }
    | { kind: "move"; key: string }
    | { kind: "operator"; key: "y" | "d" | "c" }
    | { kind: "motion"; key: "f" | "F" }
    | { kind: "scope"; key: "a" | "i" | "(" | `"` }
    // | { kind: "delimiter"; key: "(" | `"` }
    | { kind: "repeat" } // .
    | { kind: "commandStart" } // :
    | { kind: "enter" }
    | { kind: "char"; key: string }
    | { kind: "unknown" };

export type ActionType = "MOVE" | "INTERACT" | "TARGET" | "COMMAND";
export interface GameAction {
    type: ActionType;
    key?: string;
    command?: string;
    count?: number;
}
export interface ClientActionMessage {
    type: "ACTION";
    seq: number;
    clientTime: number;
    action: GameAction;
}
export type ClientMessage  = ClientActionMessage;


export interface ServerPlayerMoveMessage {
    type: "PLAYER_MOVE";
    playerId: string;
    pos: Vec2;
    facing: 'N' | 'S' | 'E' | 'W';
}
export interface ServerAckMessage {
    type: "ACK";
    seq: number;
    accepted: boolean;
    correction?: { x: number; y: number };
}
export type ServerMessage = ServerPlayerMoveMessage | ServerAckMessage;
export interface Prediction {
    seq: number;
    action: GameAction;
    snapshotBefore: Player;
}
// export type TransitionResult =
//     | { ctx: VimFSMState }
//     | { ctx: VimFSMState; emit: GameAction };
//
// export type TransitionFn = (ctx: VimFSMState, input: Input) => TransitionResult;
//
export type TransitionResult = {
    state: VimFSMState | 'reset';
    emit?: GameAction;
};
// | { state: VimFSMState; emit: GameAction }
// | { state: VimFSMState; action: GameAction };

export type TransitionFn = (
    state: VimFSMState,
    key: string,
    lastAction: null | GameAction,
) => TransitionResult;
