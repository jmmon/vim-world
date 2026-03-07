import { Player, Vec2 } from "~/types/worldTypes";
import { 
    VimAction,
    // ExpandedVimAction
} from "~/fsm/types";
import {
    addPos,
    deltaToDir,
    isWalkable,
    isWithinBounds,
    keyToDelta,
} from "~/simulation/shared/helpers";
import {
    ReasonCorrection,
    ValidateMoveCorrection,
    ValidateMoveInvalid,
    ValidateMoveValid,
} from "../../server/types";
import { ServerWorldWrapper } from "~/server/types";
import { LocalWorldWrapper } from "~/components/canvas1/types";

function validateMove(
    ctx: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
    action: VimAction,
) {
    const delta = keyToDelta(action.key);
    if (!delta)
        return { ok: false, reason: "INVALID_KEY" } as ValidateMoveInvalid;

    const dir = deltaToDir(delta); // new direction
    // const steps = Math.max(
    //     action.count ?? 1,
    //     ("remaining" in action ? (action as ExpandedVimAction).remaining : 0) +
    //         1,
    // );
    const steps = action.count ?? 1;
    const target: Vec2 = {
        x: player.pos.x,
        y: player.pos.y,
    };
    // processing multiple counts within one tick:
    let processedCount = 0;
    let reason: ReasonCorrection | undefined = undefined;
    while (processedCount < steps) {
        const next = addPos(target, delta);

        if (!isWithinBounds(ctx, next)) {
            reason = "OUT_OF_BOUNDS";
            // console.log(`!!${reason}!`, JSON.stringify(player.pos), JSON.stringify(next));
            break; // stop at map edge
        }

        if (!isWalkable(ctx, next)) {
            reason = "COLLISION";
            // console.log(`!!${reason}!`, JSON.stringify(player.pos), JSON.stringify(next));
            break; // stop at obstacle or player
        }

        target.x = next.x;
        target.y = next.y;
        processedCount++;
    }
    // console.log(`completed ${processedCount} steps: `, JSON.stringify(target));

    return { ok: !reason, reason, target, dir, processedCount } as
        | ValidateMoveValid
        | ValidateMoveCorrection;
}

export default validateMove;
