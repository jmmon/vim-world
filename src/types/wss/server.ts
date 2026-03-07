import { PlayerCheckpoint } from "~/server/checkpointService";
import { Direction, Player, Vec2 } from "../worldTypes";
import { ReasonCorrection, ReasonRejected } from "~/simulation/server/types";

type SubtypeOtherPlayerMessage = "MOVE" | "CONNECT";
export type ServerOtherPlayerMessage<T extends SubtypeOtherPlayerMessage> = {
    type: "PLAYER";
    subtype: T;
    playerId: string;
    pos: Vec2;
    dir: Direction;
};




export type SubtypeServerAck = "CORRECTION" | "REJECTION" | "ACK" | "CHECKPOINT";
export interface ServerAckBaseMessage {
    type: "ACK";
    seq?: number;
    accepted: boolean;
}
export interface ServerAckRejectionMessage extends ServerAckBaseMessage {
    subtype: "REJECTION";
    reason: ReasonRejected;
    seq: number;
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
}
export interface ServerAckCorrectionMessage extends ServerAckBaseMessage {
    subtype: "CORRECTION";
    reason: ReasonCorrection;
    seq: number;
    correction?: Vec2;
    authoritativeState?: Partial<Player>;
}
export interface ServerAckValidMessage extends ServerAckBaseMessage {
    correction?: Vec2;
    seq: number;
    authoritativeState?: Partial<Player>;
}
export interface ServerAckCheckpointMessage extends ServerAckBaseMessage {
    type: "ACK";
    accepted: boolean;
    subtype: "CHECKPOINT";
    checkpoint: PlayerCheckpoint;
}
export type ServerAckMessage<T extends SubtypeServerAck = "ACK"> = "ACK" extends T
    ? ServerAckValidMessage
    : "CORRECTION" extends T
        ? ServerAckCorrectionMessage
        : "CHECKPOINT" extends T
            ? ServerAckCheckpointMessage
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
    | ServerAckMessage<SubtypeServerAck>
    | ServerConnectionMessage<SubtypeConnectionMessage>
    | ServerAfkMessage
    | ServerInitConfirmMessage;

