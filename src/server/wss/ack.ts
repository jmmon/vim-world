import { ReasonCorrection, ReasonRejected } from "~/simulation/server/types";
import { Player, ServerPlayer } from "~/types/worldTypes";
import { ClientSession } from "../types";
import { ServerAckMessage, ServerInitConfirmMessage, ServerOtherPlayerMessage } from "~/types/wss/server";
import { PlayerCheckpoint } from "../checkpointService";
import { currentServerTick } from "../serverLoop";
import { ExpandedVimAction } from "~/fsm/types";
import { clients } from "../serverState";
import { ActionResult } from "~/components/canvas1/types";

export type AckResponseDataType = ReasonRejected | ReasonCorrection | "UNHANDLED" |  undefined;
interface AckResponseDataBase {
    seq: number;
    authoritativeState: ServerPlayer;
}
export interface AckResponseData<T extends AckResponseDataType = undefined> extends AckResponseDataBase {
    reason: T;
}

function sendRejection(client: ClientSession, {seq, authoritativeState, reason}: AckResponseData<ReasonRejected | "UNHANDLED">) {
    const reject: ServerAckMessage<"REJECTION"> = {
        type: "ACK",
        subtype: "REJECTION",
        reason,
        tick: currentServerTick,
        accepted: false,
        seq,
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(reject));
}

function sendCorrection(client: ClientSession, {seq, authoritativeState, reason}: AckResponseData<ReasonCorrection>) {
    const correction: ServerAckMessage<"CORRECTION"> = {
        type: "ACK",
        subtype: "CORRECTION",
        tick: currentServerTick,
        reason,
        accepted: false,
        seq,
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(correction));
}

function sendCommandPartial(client: ClientSession, {seq, authoritativeState}: AckResponseData, subtype: "COMMAND" | "COMMAND_PARTIAL") {
    const correction: ServerAckMessage<typeof subtype> = {
        type: "ACK",
        subtype,
        tick: currentServerTick,
        reason: undefined,
        accepted: false,
        seq,
        authoritativeState: authoritativeState, // Player object
    };
    client.ws.send(JSON.stringify(correction));
}

function sendAckValid(client: ClientSession, {seq, authoritativeState}: AckResponseData) {
    const ack: ServerAckMessage = {
        type: "ACK",
        subtype: undefined,
        tick: currentServerTick,
        reason: undefined,
        accepted: true,
        seq,
        authoritativeState: authoritativeState,
    };
    client.ws.send(JSON.stringify(ack));
}

function sendAckCheckpoint(client: ClientSession, checkpoint: PlayerCheckpoint) {
    const ack: ServerAckMessage<"CHECKPOINT"> = {
        type: "ACK",
        subtype: "CHECKPOINT",
        tick: currentServerTick,
        reason: undefined,
        accepted: true,
        checkpoint, 
    };
    client.ws.send(JSON.stringify(ack));
}

function sendInitConfirm(client: ClientSession, playerId: string, checkpoint?: PlayerCheckpoint) {
    const init: ServerInitConfirmMessage = {
        type: "INIT",
        subtype: "CONFIRM",
        checkpoint,
        playerId,
        tick: currentServerTick,
    };
    client.ws.send(JSON.stringify(init));
}

function sendResponse(
    client: ClientSession,
    player: ServerPlayer,
    reason: ActionResult['reason'] | ReasonRejected,
    expandedAction: ExpandedVimAction
) {
    const response: AckResponseData<AckResponseDataType> = {
        seq: player.lastProcessedSeq,
        authoritativeState: player,
        reason: reason,
    };

    switch(reason) {
        case undefined: 
            switch(expandedAction.type) {
                case 'COMMAND':
                    ack.command(client, response as AckResponseData<typeof reason>);
                    break;
                case 'COMMAND_PARTIAL':
                case 'COMMAND_PROMPT':
                    ack.commandPartial(client, response as AckResponseData<typeof reason>);
                    break;

                default:
                    ack.valid(client, response as AckResponseData<typeof reason>);
            }
            break;
        case "INVALID_KEY": 
        case "INVALID_ACTION": 
        case "INVALID_SEQUENCE":
            ack.rejection(client, response as AckResponseData<typeof reason>);
            break;
        case "COLLISION":
        case "OUT_OF_BOUNDS":
            ack.correction(client, response as AckResponseData<typeof reason>);
            break;
        default:
            ack.rejection(client, response as AckResponseData<typeof reason>);
    }
}

function dispatchMoveToOthers(clientId: string, player: Player) {
    const playerMove: ServerOtherPlayerMessage<"MOVE"> = {
        type: "PLAYER",
        subtype: "MOVE",
        playerId: player.id,
        pos: player.pos,
        dir: player.dir,
    };
    clients.forEach((client, key) => {
        if (key !== clientId) client.ws.send(JSON.stringify(playerMove));
    });
}

const ack = {
    valid: sendAckValid,
    correction: sendCorrection,
    rejection: sendRejection,
    checkpoint: sendAckCheckpoint,
    command: (client: ClientSession, data: AckResponseData) => sendCommandPartial(client, data, "COMMAND"),
    commandPartial: (client: ClientSession, data: AckResponseData) => sendCommandPartial(client, data, "COMMAND_PARTIAL"),
    init: sendInitConfirm,
    send: sendResponse,
};
export const message = {
    ack,
    playerMove: dispatchMoveToOthers
}
// export default ack;

