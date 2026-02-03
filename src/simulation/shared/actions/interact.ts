import { LocalWorldWrapper } from "~/components/canvas1/types";
import { ModifierKey, VimAction } from "~/fsm/types";
import { ServerWorldWrapper } from "~/server/types";
import { objHasItem } from "~/services/draw/utils";
import { ValidatePasteValid, ValidateYankValid } from "~/simulation/server/types";
import {
    MapObjWithItem,
    MapObjWithPos,
    MapObject,
    Player,
    Vec2,
} from "~/types/worldTypes";

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
    console.assert(
        TEST_objItemsBefore - TEST_objItemsAfter === 1,
        "EXPECT obj items to DECREASE by 1!",
        { before: TEST_objItemsBefore, after: TEST_objItemsAfter },
    );
    console.assert(
        TEST_playerItemsAfter - TEST_playerItemsBefore === 1,
        "EXPECT player items to INCREASE by 1!",
        { before: TEST_playerItemsBefore, after: TEST_playerItemsAfter },
    );
    return true;
}

function placeObject(obj: MapObject, player: Player, target: Vec2) {
    obj.pos = target;
    player.carryingObjId = undefined;
    return true;
}

function placeItem(obj: MapObject, player: Player) {
    console.log("placeItem:", { obj, player });
    if (!player.itemIds || player.itemIds.length === 0) return false;

    const prevLength = player.itemIds?.length;
    console.assert(
        prevLength,
        "player should have items!",
        player.itemIds,
    );
    if (obj.itemIds === undefined) obj.itemIds = [];
    const itemId = player.itemIds.shift()!; // remove first item from player
    obj.itemIds.push(itemId); // add to object

    console.assert(
        prevLength - player.itemIds?.length === 1,
        " incorrect math!: now:",
        player.itemIds,
        "\nprev:",
        prevLength,
    );
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
            return state.pickUpObject(
                target.targetObj as MapObjWithPos,
                player,
            );
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
    result: ValidatePasteValid | ValidateYankValid,
) {
    const modifier = action.command![1] as ModifierKey;
    console.log(result);
    switch (modifier) {
        case "a":
            if ((result as ValidatePasteValid).targetPos === undefined) return false;
            return placeObject(
                (result as ValidatePasteValid).obj,
                player,
                (result as ValidatePasteValid).targetPos!,
            );
        case "i":
            if ((result as ValidateYankValid).lastPosBeforeObject === undefined) return false;
            console.assert((result as ValidateYankValid).targetObj !== undefined, "missing object!!!", result);
            return placeItem(
                (result as ValidateYankValid).targetObj,
                player,
            );
        default:
            return false;
    }
};


const interact = {
    y: applyYankCommand,
    p: applyPasteCommand,
    c: applyYankCommand, // TODO:
    d: applyYankCommand, // TODO:
};
export default interact;


