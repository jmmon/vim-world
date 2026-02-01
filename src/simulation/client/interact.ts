import {
    MapObject,
    Player,
    Vec2,
    FindObjectsInRangeValid,
} from "~/types/worldTypes";
import { LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { ServerWorldWrapper } from "~/server/types";
import {
    apply,
    basicInteractValidation,
    validatePasteCommand,
} from "~/simulation/shared/interact";
import { OPTS, Opts } from "./actions";

// e.g. if ya then pick up the object, if yi then try to get the item inside the object if there is one
// some objects could be liftable and others not
// could also allow pushing them?? e.g. if pushing, process movement every 4 ticks or something
// could allow sliding of the player!!! e.g. from x to x + 1 over some time, and if you stop pressing the key or didn't do high enough count, it will reset yours and the object's positioning

export async function validateYankCommand(
    state: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
    opts?: Partial<Opts>,
) {
    // check in front of player for object matching target type
    const result = await state.findObjectInRange(player);
    if (result.targetObj === undefined) {
        console.warn("no target object found!", result);
        return false;
    }

    if (
        opts?.collision !== false &&
        !(await state.isWithinBounds(result.targetObj.pos))
    ) {
        // probably never happens unless we have objects offmap
        console.warn("found target object is OUTSIDE BOUNDS!", result);
        return false;
    }
    if (
        opts?.collision !== false &&
        !(await state.isWithinBounds(result.lastPosBeforeObject))
    ) {
        console.warn("new player position is OUTSIDE BOUNDS!", result);
        return false;
    }
    return result as FindObjectsInRangeValid;
}


const validate = {
    interact: {
        y: validateYankCommand,
        p: validatePasteCommand,
    },
};

export async function applyInteraction(
    state: LocalWorldWrapper,
    action: VimAction,
    opts?: Partial<Opts>,
) {
    const { prediction, collision }: Opts = {
        ...OPTS,
        ...opts,
    };
    if (!prediction) return false;

    const basicResult = basicInteractValidation(action);
    if (!basicResult.ok) return false;

    const actionType = action.command?.[0] as 'p' | 'y';
    const validationResult = await validate.interact[actionType](state, state.client.player!, {
        collision,
    });
    if (!validationResult) return false;

    const result = (actionType === 'y') 
        ? await apply.interact[actionType](state, state.client.player!, action, validationResult as FindObjectsInRangeValid)
        : await apply.interact[actionType](state, state.client.player!, action, validationResult as {targetPos: Vec2, obj: MapObject})

    if (result) return {players: true, objects: true};
    return false;
}
