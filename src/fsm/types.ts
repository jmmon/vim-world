import { Direction, Player, Vec2 } from "~/components/canvas1/types";
import { PlayerCheckpoint } from "~/server/checkpointService";

export type VimMode = "normal" | "operator" | "awaitingChar" | "command";

export interface VimFSMState {
    mode: VimMode;
    count: number | null;
    operator?: "y" | "d" | "c"; // more?
    motion?: string; // "f" | "F" // more?
    buffer: string[];
    lastAction?: GameAction;
}

export type ActionType = "MOVE" | "INTERACT" | "TARGET" | "COMMAND";
export interface GameAction {
    type: ActionType;
    key?: string;
    command?: string;
    count?: number;
}


// send to server
export interface ClientActionMessage {
    type: "ACTION";
    seq: number;
    clientTime: number;
    action: GameAction;
}
export interface ClientInitMessage {
    type: "INIT";
    playerId: string;
}
export interface ClientCheckpointSaveMessage {
    type: "SAVE_CHECKPOINT";
    checkpoint: PlayerCheckpoint;
    isClosing?: boolean; // if after client received a 'CLOSE_START' event
}
export type ClientMessage =
    | ClientActionMessage
    | ClientInitMessage
    | ClientCheckpointSaveMessage;


// send from server:
// send to other clients:
export type ServerPlayerMoveMessage = {
    type: "PLAYER_MOVE";
    playerId: string;
    pos: Vec2;
    dir: Direction;
}
export type ServerAckType = "ACK" | "REJECTION" | "CORRECTION";
export type ServerAckMessage<T extends ServerAckType> = {
    type: T;
    seq: number;
    accepted: boolean;
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
    dir?: Direction;
}
type ConnectionMessage = "AFK" | "CLOSE_START" | "CLOSE" | "TERMINATE";
export type ServerAfkMessage<T extends ConnectionMessage> = {
    type: T;
}
// export type ServerLoadCheckpointMessage = {
//     type: "LOAD_CHECKPOINT";
//     checkpoint: PlayerCheckpoint;
// }
export type ServerInitConfirmMessage = {
    type: "INIT_CONFIRM";
    checkpoint: PlayerCheckpoint;
    playerId: string;
}
export type ServerMessage = 
    | ServerPlayerMoveMessage
    | ServerAckMessage<ServerAckType>
    | ServerAfkMessage<ConnectionMessage>
    // | ServerLoadCheckpointMessage
    | ServerInitConfirmMessage;



export type TransitionResult = {
    state: VimFSMState | "reset";
    emit?: GameAction;
};

export type TransitionFn = (
    state: VimFSMState,
    event: KeyboardEvent,
    lastAction: null | GameAction,
) => TransitionResult;
