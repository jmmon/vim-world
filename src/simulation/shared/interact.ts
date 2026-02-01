import { LocalWorldWrapper } from "~/components/canvas1/types";
import { Opts } from "~/simulation/client/actions";
import {
    applyRangeToDelta,
    combinePos,
    dirToDelta,
    isWithinBounds,
} from "~/simulation/client/helpers";
import { VimAction } from "~/fsm/types";
import { ServerWorldWrapper } from "~/server/types";
import { objHasItem } from "~/services/draw/utils";
import {
    FindObjectsInRangeError,
    FindObjectsInRangeResult,
    FindObjectsInRangeValid,
    MapObjWithItem,
    MapObjWithPos,
    MapObject,
    Player,
    Vec2,
} from "~/types/worldTypes";

export function findObjectInRange(
    this: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
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

    // TODO: decide if range can help yank in vertical directions or only horizontal

    const delta = dirToDelta(player.dir);
    for (let i = 1; i <= modifiedRange; i++) {
        // check each range level, return object if it finds it
        const ranged = applyRangeToDelta(i, delta);
        const targetPos = combinePos(ranged, player!.pos);
        const targetObj = this.world.objects.find(
            ({ pos }) => pos && pos.x === targetPos.x && pos.y === targetPos.y,
        );
        console.log(
            "looking:",
            ranged,
            targetPos,
            targetObj,
            this.world.objects,
        );
        if (targetObj) {
            result.targetObj = targetObj as MapObjWithPos;
            return result as FindObjectsInRangeValid;
        }
        result.lastPosBeforeObject.x = targetPos.x;
        result.lastPosBeforeObject.y = targetPos.y;
    }

    return result as FindObjectsInRangeError;
}

export function validatePasteCommand(
    state: LocalWorldWrapper | ServerWorldWrapper,
    player: Player,
    opts?: Partial<Opts>,
) {
    if (!player?.carryingObjId) return false;

    const delta = dirToDelta(player.dir);
    const targetPos = combinePos(delta, player.pos);
    if (opts?.collision !== false && !isWithinBounds(state.world.map, targetPos)) return false;

    const obj = state.world.objects.find(
        ({ id }) => id === player.carryingObjId,
    );
    if (!obj) return false;

    return {
        targetPos,
        obj,
    };
}

export const VALID_YANK_PASTE_TARGETS = [
    "[",
    "]",
    "{",
    "}",
    "(",
    ")",
    "<",
    ">",
    '"',
    "'",
    "`",
];
export const VALID_YANK_PASTE_COMMANDS = [
    "y", "p",
];
export const VALID_YANK_PASTE_MODIFIERS = [
    "a", "i",
];
export function basicInteractValidation(action: VimAction): {ok: true, reason: undefined} | {ok: false, reason: "INVALID_KEY"} {
    console.assert(
        action.command?.length === 3,
        "EXPECTED command length to be 3!",
        action.command,
        action.command?.length,
    );
    if (action.command?.length !== 3)
        return { ok: false, reason: "INVALID_KEY" };

    const command = action.command?.[0];
    if (!command) return { ok: false, reason: "INVALID_KEY" };
    if (!VALID_YANK_PASTE_COMMANDS.includes(command))
        return { ok: false, reason: "INVALID_KEY" };

    const modifier = action.command?.[0];
    if (!modifier) return { ok: false, reason: "INVALID_KEY" };
    if (!VALID_YANK_PASTE_COMMANDS.includes(modifier))
        return { ok: false, reason: "INVALID_KEY" };

    const target = action.command?.[action.command?.length - 1];
    if (!target) return { ok: false, reason: "INVALID_KEY" };
    if (!VALID_YANK_PASTE_TARGETS.includes(target))
        return { ok: false, reason: "INVALID_KEY" };

    return { ok: true, reason: undefined };
}




export function pickUpObject(obj: MapObject, player: Player) {
    player.carryingObjId = obj.id;
    obj.pos = undefined;
    return true;
}

export function pickUpItem(obj: MapObjWithItem, player: Player) {
    const TEST_objItemsBefore = obj.itemIds?.length;
    const firstItem = obj.itemIds.shift();
    const TEST_objItemsAfter = obj.itemIds?.length;
    player.itemIds ??= [];
    const TEST_playerItemsBefore = player.itemIds.length;
    player.itemIds.push(firstItem!);
    const TEST_playerItemsAfter = player.itemIds.length;
    console.assert(TEST_objItemsBefore - TEST_objItemsAfter === 1, 'EXPECT obj items to DECREASE by 1!', {before: TEST_objItemsBefore, after: TEST_objItemsAfter});
    console.assert(TEST_playerItemsAfter - TEST_playerItemsBefore === 1, 'EXPECT player items to INCREASE by 1!', {before: TEST_playerItemsBefore, after: TEST_playerItemsAfter});
    return true;
}

export function placeObject(obj: MapObject, player: Player, target: Vec2) {
    obj.pos = target;
    player.carryingObjId = undefined;
    return true;
}







async function applyYankCommand(
    state: ServerWorldWrapper | LocalWorldWrapper,
    player: Player,
    action: VimAction,
    target: {
        targetObj: MapObject;
        lastPosBeforeObject: Vec2;
    },
) {
    // move player into position
    player.pos = target.lastPosBeforeObject;
    const modifier = action.command?.[1];

    // attempt to pick up item
    switch (modifier) {
        case "a":
            // "around" e.g. pick up the object??
            if (player.carryingObjId) return false; // already carrying
            if (!target.targetObj.liftable) return false; // not liftable
            return state.pickUpObject(target.targetObj, player);
        case "i":
            // "inside" e.g. pick up the item within the object
            if (!objHasItem(target.targetObj)) return false;
            return state.pickUpItem(target.targetObj, player);
        default:
            return false;
    }
}

async function applyPasteCommand(
    state: ServerWorldWrapper | LocalWorldWrapper,
    player: Player,
    action: VimAction,
    target: {
        obj: MapObject;
        targetPos: Vec2;
    },
) {
    const modifier = action.command?.[1];
    switch (modifier) {
        case "a":
        case "i":
            return state.placeObject(
                target.obj,
                player,
                target.targetPos,
            );
        default:
            return false;
    }
}

const apply = {
    interact: {
        y: applyYankCommand,
        p: applyPasteCommand,
    }
}
export {apply};
