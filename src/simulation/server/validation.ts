import { Player, Vec2 } from "~/types/worldTypes";
import { VimAction } from "~/fsm/types";
import { WORLD_WRAPPER } from "~/server/serverState";
import { ReasonCorrection, ValidateInteractResult, ValidateMoveResult, ValidatePasteResult } from "./types";
import { basicInteractValidation, validatePasteCommand } from "~/simulation/shared/interact";
import { combinePos, deltaToDirection, keyToDelta } from "~/simulation/client/helpers";

function validateMove(player: Player, action: VimAction): ValidateMoveResult {
    const delta = keyToDelta(action.key);
    if (!delta) return { ok: false, reason: "INVALID_KEY" };

    const dir = deltaToDirection(delta); // new direction
    const steps = action.count ?? 1;
    const target: Vec2 = {
        x: player.pos.x,
        y: player.pos.y,
    }
    // processing multiple counts within one tick:
    let processedCount = 0;
    let reason: ReasonCorrection | undefined = undefined;
    while (processedCount < steps) {
        const next = combinePos(player.pos, delta);

        if (!WORLD_WRAPPER.isWithinBounds(next)) {
            console.error("not within bounds!", player.pos, next);
            reason = "OUT_OF_BOUNDS";
            break; // stop at map edge
        }

        if (!WORLD_WRAPPER.isWalkable(next)) {
            reason = "COLLISION";
            break; // stop at obstacle or player
        }

        target.x = next.x;
        target.y = next.y;
        processedCount++;
    }
    

    // TODO: e.g. if processing only one count per tick, takes 3 ticks to move 3j
    //
    // const target = {
    //     x: player.pos.x + dir.x,
    //     y: player.pos.y + dir.y
    // };
    //
    // if (!WORLD.isWithinBounds(target)) {
    //     return { ok: false, reason: "OUT_OF_BOUNDS" };
    // }
    //
    // if (!WORLD.isWalkable(target)) {
    //     return { ok: false, reason: "COLLISION" };
    // }
    
    if (reason) return { ok: false, reason, target, dir };

    return { ok: true, reason, target, dir };
}


function validateYank(player: Player): ValidateInteractResult {
    const result = WORLD_WRAPPER.findObjectInRange(player);
    if (!result.targetObj) {
        console.warn('no target object found!', result);
        return { ok: false, reason: "INVALID_ACTION" };
    }

    if (!WORLD_WRAPPER.isWithinBounds(result.targetObj.pos)) {
        // probably never happens unless we have objects offmap
        console.warn('found target object is OUTSIDE BOUNDS!', result);
        return { ok: false, reason: "OUT_OF_BOUNDS" };
    }
    if (!WORLD_WRAPPER.isWithinBounds(result.lastPosBeforeObject)) {
        console.warn('new player position is OUTSIDE BOUNDS!', result);
        return { ok: false, reason: "OUT_OF_BOUNDS" };
    }

    return {
        ok: true,
        reason: undefined,
        targetObj: result.targetObj,
        lastPosBeforeObject: result.lastPosBeforeObject
    };
}

function validatePaste(player: Player): ValidatePasteResult {
    const res = validatePasteCommand(WORLD_WRAPPER, player);
    if (!res) return { ok: false, reason: "INVALID_ACTION" };
    return {ok: true, reason: undefined, obj: res.obj, targetPos: res.targetPos};
}


const validate = {
    move: validateMove,
    interact: {
        p: validatePaste,
        y: validateYank,
        basic: basicInteractValidation,
    },
};

export default validate;




