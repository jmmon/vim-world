import { ClientActionMessage } from "~/types/messageTypes";
import { Direction, Player, Vec2 } from "~/types/worldTypes";
import { ApplyActionResult, ApplyInteractResult, ApplyMoveResult, ValidateMoveCorrection, ValidatePasteValid, ValidateYankValid } from "./types";
import { WORLD_WRAPPER } from "~/server/serverState";
import applies from "~/simulation/shared/actions";
import { ModifierKey, OperatorKey, TargetKey } from "~/fsm/types";
import serverValidators from "./validators";

function applyMoveToWorld(player: Player, msg: ClientActionMessage, result: { target: Vec2, dir?: Direction }) {
    player.pos.x = result.target.x;
    player.pos.y = result.target.y;
    if (result.dir) player.dir = result.dir;
    player.lastProcessedSeq = msg.seq;
}

function applyMoveToServerWorld(player: Player, msg: ClientActionMessage): ApplyMoveResult {
    const result = serverValidators.move(player, msg.action);
    if (!result.ok) {
        if (result.reason === 'INVALID_KEY' || result.reason === 'INVALID_ACTION') {
            return {
                seq: msg.seq,
                reason: result.reason,
            };
        } 

        // apply corrected move
        applyMoveToWorld(player, msg, result as ValidateMoveCorrection);
        return {
            seq: msg.seq,
            reason: result.reason,
        };
    }
    
    // apply fully valid move
    applyMoveToWorld(player, msg, result);
    return {
        seq: msg.seq,
        reason: undefined,
    };
}

async function applyInteractToServerWorld(player: Player, msg: ClientActionMessage): Promise<ApplyInteractResult> {
    const basicResult = serverValidators.interact.basic(msg.action);
    if (!basicResult.ok) return { seq: msg.seq, reason: basicResult.reason };

    const actionType = msg.action.command?.[0] as OperatorKey;
    const modifier = msg.action.command![1] as ModifierKey;
    const target = msg.action.command![2] as TargetKey;

    const result = await serverValidators.interact[actionType][modifier](WORLD_WRAPPER, player, target);

    if (!result || !result?.ok) return {
        seq: msg.seq,
        reason: result.reason, // 'OUT_OF_BOUNDS' | 'COLLISION' | 'INVALID_KEY' | 'INVALID_ACTION'
    };

    if (actionType === 'p') {
        await applies.interact[actionType](WORLD_WRAPPER, player, msg.action, result as ValidatePasteValid)
    } else {
        await applies.interact[actionType](WORLD_WRAPPER, player, msg.action, result as ValidateYankValid)
    }

    return {
        seq: msg.seq,
        reason: undefined,
    };
}

export default async function applyActionToServerWorld(player: Player, msg: ClientActionMessage): Promise<ApplyActionResult> {
    let result: ApplyActionResult;
    switch (msg.action.type) {
        case "MOVE":
            result = applyMoveToServerWorld(player, msg)
            break;
        case "INTERACT":
            result = await applyInteractToServerWorld(player, msg);
            break;
        // case "TARGET":
        //     // TODO:
        //     return { seq: msg.seq, reason: 'NOT_YET_IMPLEMENTED' };
        // case "COMMAND":
        //     // TODO:
        //     return { seq: msg.seq, reason: 'NOT_YET_IMPLEMENTED' };
        default: 
            // TODO:
            result = { seq: msg.seq, reason: 'INVALID_ACTION' };
    }

    console.log(result, ' ~~ at:', msg.seq, ' action:', msg.action, ' player:', player);

    return result;
}

