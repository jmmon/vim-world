import {
    applyRangeToDelta,
    combinePos,
    dirToDelta,
} from "~/simulation/client/helpers";
import {
    MODIFIER_KEYS,
    OPERATOR_KEYS,
    VALID_YANK_PASTE_TARGETS,
} from "~/fsm/transtionTable";
import { LocalWorldWrapper } from "~/components/canvas1/types";
import {
    FindObjectsInRangeError,
    FindObjectsInRangeResult,
    FindObjectsInRangeValid,
    Player,
    Vec2,
    WorldEntity,
} from "~/types/worldTypes";
import { ServerWorldWrapper } from "~/server/types";
import { ModifierKey, OperatorKey, TargetKey, VimAction } from "~/fsm/types";
import {
    ValidatePasteResult,
    ValidateYankResult,
} from "~/simulation/server/types";

// for yank command
export function findObjectInRangeByKey(
    this: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
    key: string,
): FindObjectsInRangeResult {
    const FACTOR = 0.5;
    const modifiedRange = Math.ceil((player?.level || 1) * FACTOR);
    const result: FindObjectsInRangeResult = {
        targetObj: undefined,
        modifiedRange,
        dir: player.dir,
        lastPosBeforeObject: {
            // new player's position
            x: player.pos.x,
            y: player.pos.y,
        },
    };
    console.log("searching for:", key, "in objects towards:", player.dir);

    // TODO: decide if range can help yank in vertical directions or only horizontal

    const delta = dirToDelta(player.dir);
    for (let i = 1; i <= modifiedRange; i++) {
        // check each range level, return object if it finds it
        const ranged = applyRangeToDelta(i, delta);
        const targetPos = combinePos(ranged, player!.pos);
        // instead of finding each loop, could filter to find in a straight line and loop over those
        // but items are just a list, maybe i could make it an array of arrays and insert them at coordinates
        // then it could be searched easier
        const entitiesArray = Array.from(this.world.entities.values());
        const targetObj = entitiesArray.find(
            (o) =>
                o.interactable &&
                o.pos &&
                o.pos.x === targetPos.x &&
                o.pos.y === targetPos.y &&
                o.interactable.selectors.includes(key),
        );
        console.log(
            `looking for ${key}:`,
            ranged,
            targetPos,
            targetObj,
            entitiesArray,
        );
        if (targetObj) {
            result.targetObj = targetObj;
            return result as FindObjectsInRangeValid;
        }
        result.lastPosBeforeObject.x = targetPos.x;
        result.lastPosBeforeObject.y = targetPos.y;
    }

    return result as FindObjectsInRangeError;
}

// for pasting objects command
export type ValidatePasteObjectResult = {
    targetPos: Vec2;
    obj: WorldEntity;
};
export async function validateCarryingObjectAndEmptyInFront(
    state: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
): Promise<ValidatePasteObjectResult | false> {
    const collision = await state.getPhysicsCollision();

    if (!player?.carryingObjId) return false;

    const delta = dirToDelta(player.dir);
    const targetPos = combinePos(delta, player.pos);
    if (collision !== false) {
        if (!(await state.isWithinBounds(targetPos))) return false;

        const entitiesArray = Array.from(state.world.entities.values());
        if (
            entitiesArray.some(
                ({ pos }) => pos?.x === targetPos.x && pos.y === targetPos.y,
            )
        )
            return false;
    }

    const obj = state.world.entities.get(player.carryingObjId);
    if (!obj) return false;

    return {
        targetPos,
        obj,
    };
}

export type BasicInteractValidationResult =
    | { ok: true; reason: undefined }
    | { ok: false; reason: "INVALID_KEY" };
export function basicInteractValidation(
    action: VimAction,
): BasicInteractValidationResult {
    console.log("basicInteractValidation:", action);
    console.assert(
        action.command?.length === 3,
        "EXPECTED command length to be 3!",
        action.command,
        action.command?.length,
    );
    if (action.command?.length !== 3)
        return { ok: false, reason: "INVALID_KEY" };

    const [command, modifier, target] = action.command;

    if (!command || !OPERATOR_KEYS.includes(command as OperatorKey))
        return { ok: false, reason: "INVALID_KEY" };

    if (!modifier || !MODIFIER_KEYS.includes(modifier as ModifierKey))
        return { ok: false, reason: "INVALID_KEY" };

    if (!target || !VALID_YANK_PASTE_TARGETS.includes(target as TargetKey))
        return { ok: false, reason: "INVALID_KEY" };

    return { ok: true, reason: undefined };
}

async function validateFindObjectInRangeByKey(
    state: ServerWorldWrapper | LocalWorldWrapper,
    player: Player,
    key: string,
): Promise<ValidateYankResult> {
    const collision = await state.getPhysicsCollision();
    const result = await state.findObjectInRangeByKey(player, key);
    console.log("validateYank result:", result);
    if (!result.targetObj) {
        console.warn("no target object found!", result);
        return { ok: false, reason: "INVALID_ACTION" };
    }

    // hopefully work for both client and server: server has no opts, client might have opts
    if (collision !== false) {
        if (!state.isWithinBounds(result.targetObj.pos!)) {
            // probably never happens unless we have objects offmap
            console.warn("found target object is OUTSIDE BOUNDS!", result);
            return { ok: false, reason: "OUT_OF_BOUNDS" };
        }
        if (!state.isWithinBounds(result.lastPosBeforeObject)) {
            console.warn("new player position is OUTSIDE BOUNDS!", result);
            return { ok: false, reason: "OUT_OF_BOUNDS" };
        }
    }

    return {
        ok: true,
        reason: undefined,
        targetObj: result.targetObj,
        lastPosBeforeObject: result.lastPosBeforeObject,
    };
}


async function validatePlaceCarryingObjectTowardsDir(
    state: ServerWorldWrapper | LocalWorldWrapper,
    player: Player,
): Promise<ValidatePasteResult> {
    const res = await validateCarryingObjectAndEmptyInFront(state, player);
    if (!res)
        return {
            ok: false,
            reason: "INVALID_ACTION",
        };

    return {
        ok: true,
        reason: undefined,
        obj: res.obj,
        targetPos: res.targetPos,
    };
}

// move: validateMove,
const interact = {
    p: {
        // pasting around: paste an object into an empty space
        a: validatePlaceCarryingObjectTowardsDir,
        // pasting inside: paste an item into an object // make sure there's an object
        i: validateFindObjectInRangeByKey,
    },
    y: {
        // yanking inside: grab an object // make sure there's an object
        a: validateFindObjectInRangeByKey,
        // yanking inside: grab an item from inside an object // make sure there's an object
        i: validateFindObjectInRangeByKey,
    },
    d: {
        a: validateFindObjectInRangeByKey,
        i: validateFindObjectInRangeByKey,
    },
    c: {
        a: validateFindObjectInRangeByKey,
        i: validateFindObjectInRangeByKey,
    },
    basic: basicInteractValidation,
};

export default interact;
