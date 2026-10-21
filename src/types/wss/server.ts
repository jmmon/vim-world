import { PlayerCheckpoint } from "~/server/checkpointService";
import { Direction, Player, ServerPlayer, Vec2 } from "../worldTypes";
import { ReasonCorrection, ReasonRejected } from "~/simulation/server/types";

type ServerBaseMessage = {
    type: string;
    subtype?: string;
    reason?: string;
}

type SubtypeOtherPlayerMessage = "MOVE" | "CONNECT";
export interface ServerOtherPlayerMessage<T extends SubtypeOtherPlayerMessage> extends ServerBaseMessage {
    type: "PLAYER";
    subtype: T;
    playerId: string;
    pos: Vec2;
    dir: Direction;
};

/** a player entering the world; carries the full record so receivers can render it */
export interface ServerPlayerConnectMessage extends ServerBaseMessage {
    type: "PLAYER";
    subtype: "CONNECT";
    player: Player;
};

/** a player left the world and should stop being rendered */
export interface ServerPlayerDisconnectMessage extends ServerBaseMessage {
    type: "PLAYER";
    subtype: "DISCONNECT";
    playerId: string;
};

export type SubtypeServerAck =
    | "CORRECTION"
    | "REJECTION"
    | "CHECKPOINT"
    | "COMMAND"
    | "COMMAND_PARTIAL"
    | 'ACK';
export interface ServerAckBaseMessage extends ServerBaseMessage {
    type: "ACK";
    seq?: number;
    accepted: boolean;
    tick: number;
}

export interface ServerAckRejectionMessage extends ServerAckBaseMessage {
    subtype: "REJECTION";
    reason: ReasonRejected | "UNHANDLED";
    seq: number;
    correction?: Vec2;
    authoritativeState?: Partial<ServerPlayer>;
}
export interface ServerAckCorrectionMessage extends ServerAckBaseMessage {
    subtype: "CORRECTION";
    reason: ReasonCorrection;
    seq: number;
    correction?: Vec2;
    authoritativeState?: Partial<ServerPlayer>;
}
export interface ServerAckValidMessage extends ServerAckBaseMessage {
    correction?: Vec2;
    seq: number;
    authoritativeState?: Partial<ServerPlayer>;
    reason: undefined;
}
export interface ServerAckCommandMessage extends ServerAckBaseMessage {
    subtype: "COMMAND" | "COMMAND_PARTIAL";
    seq: number;
    authoritativeState?: Partial<ServerPlayer>;
    reason: undefined;
}
export interface ServerAckCheckpointMessage extends ServerAckBaseMessage {
    subtype: "CHECKPOINT";
    checkpoint: PlayerCheckpoint;
    reason: undefined;
}
export type ServerAckMessage<T extends SubtypeServerAck = 'ACK'> =
    'ACK' extends T
        ? ServerAckValidMessage
        : "CORRECTION" extends T
          ? ServerAckCorrectionMessage
          : "CHECKPOINT" extends T
            ? ServerAckCheckpointMessage
            : "COMMAND" extends T
              ? ServerAckCommandMessage
              : "COMMAND_PARTIAL" extends T
                ? ServerAckCommandMessage
                : ServerAckRejectionMessage
;

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

export interface ServerInitConfirmMessage extends ServerBaseMessage {
    type: "INIT";
    subtype: "CONFIRM";
    checkpoint?: PlayerCheckpoint;
    playerId: string;
    tick?: number;
};


export type ServerMessage =
    | ServerOtherPlayerMessage<"MOVE">
    | ServerPlayerConnectMessage
    | ServerPlayerDisconnectMessage
    | ServerAckMessage<SubtypeServerAck>
    | ServerConnectionMessage<SubtypeConnectionMessage>
    | ServerAfkMessage
    | ServerInitConfirmMessage;
