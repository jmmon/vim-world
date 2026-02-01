import { ClientActionMessage } from "~/types/messageTypes";
import { Direction, Player, Vec2 } from "~/types/worldTypes";
import { ApplyActionResult, ApplyInteractResult, ApplyMoveResult, ValidateMoveCorrection, ValidatePasteValid, ValidateYankValid } from "./types";
import validate from "./validation";
import { WORLD_WRAPPER } from "~/server/serverState";
import { apply } from "~/simulation/shared/interact";

function applyMoveToWorld(player: Player, msg: ClientActionMessage, result: { target: Vec2, dir?: Direction }) {
    player.pos.x = result.target.x;
    player.pos.y = result.target.y;
    if (result.dir) player.dir = result.dir;
    player.lastProcessedSeq = msg.seq;
}

function applyMoveToServerWorld(player: Player, msg: ClientActionMessage): ApplyMoveResult {
    const result = validate.move(player, msg.action);
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

// TODO:
async function applyInteractToServerWorld(player: Player, msg: ClientActionMessage): Promise<ApplyInteractResult> {
    const basicResult = validate.interact.basic(msg.action);
    if (!basicResult.ok) return { seq: msg.seq, reason: basicResult.reason };

    const actionType = msg.action.command?.[0] as 'p' | 'y';
    const result = validate.interact[actionType](player);

    if (!result.ok) return {
        seq: msg.seq,
        reason: result.reason, // 'OUT_OF_BOUNDS' | 'COLLISION' | 'INVALID_KEY' | 'INVALID_ACTION'
    };


    if (actionType === 'y') {
        apply.interact[actionType](WORLD_WRAPPER, player, msg.action, result as ValidateYankValid)
    } else {
        await apply.interact[actionType](WORLD_WRAPPER, player, msg.action, result as ValidatePasteValid)
    }

    return {
        seq: msg.seq,
        reason: undefined,
    };
}

export async function applyActionToServerWorld(player: Player, msg: ClientActionMessage): Promise<ApplyActionResult> {
    switch (msg.action.type) {
        case "MOVE":
            return applyMoveToServerWorld(player, msg)
        case "INTERACT":
            return applyInteractToServerWorld(player, msg);
        // case "TARGET":
        //     // TODO:
        //     return { seq: msg.seq, reason: 'NOT_YET_IMPLEMENTED' };
        // case "COMMAND":
        //     // TODO:
        //     return { seq: msg.seq, reason: 'NOT_YET_IMPLEMENTED' };
        default: 
            // TODO:
            return { seq: msg.seq, reason: 'INVALID_ACTION' };
    }
}

