import { VimAction } from "~/fsm/types";
import { PlayerCheckpoint } from "~/server/checkpointService";
import { Direction, Player, Vec2 } from "./worldTypes";
import { ReasonCorrection, ReasonRejected } from "~/simulation/server/types";

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

export type ClientMessage =
    | ClientActionMessage
    | ClientInitMessage
    | ClientCheckpointMessage<SubtypeCheckpointMessage>;

// server -> client(s)
type SubtypeOtherPlayerMessage = "MOVE" | "CONNECT";
export type ServerOtherPlayerMessage<T extends SubtypeOtherPlayerMessage> = {
    type: "PLAYER";
    subtype: T;
    playerId: string;
    pos: Vec2;
    dir: Direction;
};

export type ServerAckType = "CORRECTION" | "REJECTION" | "ACK";
export interface ServerAckBaseMessage {
    type: "ACK";
    seq: number;
    accepted: boolean;
    dir?: Direction;
}
export interface ServerAckRejectionMessage extends ServerAckBaseMessage {
    subtype: "REJECTION";
    reason: ReasonRejected;
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
}
export interface ServerAckCorrectionMessage extends ServerAckBaseMessage {
    subtype: "CORRECTION";
    reason: ReasonCorrection;
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
}
export interface ServerAckValidMessage extends ServerAckBaseMessage {
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
}
export type ServerAckMessage<T extends ServerAckType = "ACK"> = "ACK" extends T
    ? ServerAckValidMessage
    : "CORRECTION" extends T
      ? ServerAckCorrectionMessage
      : ServerAckRejectionMessage;

type SubtypeConnectionMessage = "START" | "END";
export type ServerConnectionMessage<
    T extends SubtypeConnectionMessage | undefined = undefined,
> = T extends undefined
    ? { type: "CLOSE" }
    : {
          type: "CLOSE";
          subtype: T;
      };

export type ServerAfkMessage = {
    type: "AFK";
};

export type ServerInitConfirmMessage = {
    type: "INIT";
    subtype: "CONFIRM";
    checkpoint?: PlayerCheckpoint;
    playerId: string;
};

export type ServerMessage =
    | ServerOtherPlayerMessage<SubtypeOtherPlayerMessage>
    | ServerAckMessage<ServerAckType>
    | ServerConnectionMessage<SubtypeConnectionMessage>
    | ServerAfkMessage
    | ServerInitConfirmMessage;
