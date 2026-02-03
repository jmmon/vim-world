import { Player, Vec2 } from "~/types/worldTypes";
import { VimAction } from "~/fsm/types";
import { WORLD_WRAPPER } from "~/server/serverState";
import { combinePos, deltaToDir, keyToDelta } from "~/simulation/client/helpers";
import { ReasonCorrection, ValidateMoveResult } from "../types";

function validateMove(player: Player, action: VimAction): ValidateMoveResult {
    const delta = keyToDelta(action.key);
    if (!delta) return { ok: false, reason: "INVALID_KEY" };

    const dir = deltaToDir(delta); // new direction
    const steps = action.count ?? 1;
    const target: Vec2 = {
        x: player.pos.x,
        y: player.pos.y,
    }
    // processing multiple counts within one tick:
    let processedCount = 0;
    let reason: ReasonCorrection | undefined = undefined;
    while (processedCount < steps) {
        const next = combinePos(target, delta);

        if (!WORLD_WRAPPER.isWithinBounds(next)) {
            console.log("!!not within bounds!", player.pos, next);
            reason = "OUT_OF_BOUNDS";
            break; // stop at map edge
        }

        if (!WORLD_WRAPPER.isWalkable(next)) {
            console.log("!!collision!", player.pos, next);
            reason = "COLLISION";
            break; // stop at obstacle or player
        }

        target.x = next.x;
        target.y = next.y;
        processedCount++;
        console.log(`completed ${processedCount} steps:`, target);
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

export default validateMove;


