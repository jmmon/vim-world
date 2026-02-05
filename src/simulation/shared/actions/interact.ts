import { LocalWorldWrapper } from "~/components/canvas1/types";
import { ModifierKey, VimAction } from "~/fsm/types";
import { ServerWorldWrapper } from "~/server/types";
import { entityHasItem } from "~/services/draw/utils";
import { ValidateInteractValid, ValidatePasteValid, ValidateYankValid } from "~/simulation/server/types";
import {
    WorldEntity,
    Player,
    Vec2,
} from "~/types/worldTypes";

export function pickUpObject(entity: WorldEntity, player: Player) {
    player.carryingObjId = entity.id;
    entity.pos = undefined;
    return true;
}

// TODO: if object is an item-wrapper, remove the object; it will get placed when placing the item
export function pickUpItem(entity: WorldEntity, player: Player) {
    const isItemWrapper = entity.type === 'ITEM_ENTITY';

    const firstItem = entity.container!.itemIds.shift();
    player.itemIds ??= [];
    player.itemIds.push(firstItem!);
    if (isItemWrapper) {
        entity.pos = undefined; // remove from board
    }
    return true;
}



function placeObject(entity: WorldEntity, player: Player, target: Vec2) {
    entity.pos = target;
    player.carryingObjId = undefined;
    return true;
}

// TODO: placing an item with item-wrapper: no need to find an object, it places and re-creates the wrapper
// how to handle this???
// - different validation: paste inside:
// > - if item should be wrapped (how to tell???) then create/find wrapper and place it, then place item inside
// > - 
// > - (done) else if item should NOT be wrapped, have to find the nearby object and put inside
function placeItem(entity: WorldEntity, player: Player) {
    console.log("placeItem:", { obj: entity, player });
    if (!player.itemIds || player.itemIds.length === 0) return false;
    if (!entity.container) return false;

    const prevLength = player.itemIds?.length;
    console.assert(
        prevLength,
        "player should have items!",
        player.itemIds,
    );
    
    const itemId = player.itemIds.shift()!; // remove first item from player
    entity.container.itemIds.push(itemId); // add to object

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
        targetObj: WorldEntity;
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
            if (!target.targetObj.liftable?.canCarry) return false; // not liftable
            return state.pickUpObject(
                target.targetObj,
                player,
            );
        case "i":
            // "inside" e.g. pick up the item within the object
            if (!entityHasItem(target.targetObj)) return false;
            return state.pickUpItem(target.targetObj, player);
        default:
            return false;
    }
}


function isPasteValid(result: ValidateInteractValid): result is ValidatePasteValid {
    return (result as ValidatePasteValid).obj !== undefined;
}
function isYankValid(result: ValidateInteractValid): result is ValidateYankValid {
    return (result as ValidateYankValid).targetObj !== undefined;
}

async function applyPasteCommand(
    state: ServerWorldWrapper | LocalWorldWrapper,
    player: Player,
    action: VimAction,
    result: ValidateInteractValid,
) {
    const modifier = action.command![1] as ModifierKey;
    console.log(result);
    switch (modifier) {
        case "a":
            if (!isPasteValid(result)) return false;
            return placeObject(
                result.obj,
                player,
                result.targetPos!,
            );
        case "i":
            if (!isYankValid(result)) return false;
            console.assert(result.targetObj !== undefined, "missing object!!!", result);
            return placeItem(
                result.targetObj,
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


