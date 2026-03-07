import { VimAction } from "~/fsm/types";
import { PlayerCheckpoint } from "~/server/checkpointService";

// client -> server
export interface ClientActionMessage {
    type: "ACTION";
    seq: number;
    clientTime: number;
    action: VimAction;
}

export interface ClientInitMessage {
    type: "INIT"; // aka checkpoint load??
    playerId: string;
}
type SubtypeCheckpointMessage = "SAVE" | "LOAD";
export interface ClientCheckpointMessage<T extends SubtypeCheckpointMessage> {
    type: "CHECKPOINT";
    subtype: T;
    checkpoint: PlayerCheckpoint;
    isClosing?: boolean; // if after client received a 'CLOSE_START' event
}

export interface ClientLogoutMessage {
    type: "LOGOUT";
    checkpoint: PlayerCheckpoint;
}

export type ClientMessage =
    | ClientActionMessage
    | ClientInitMessage
    | ClientCheckpointMessage<SubtypeCheckpointMessage>
    | ClientLogoutMessage;
