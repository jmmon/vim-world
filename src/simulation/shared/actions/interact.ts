import { ModifierKey, OperatorKey, VimAction } from "~/fsm/types";
import { entityHasItem } from "~/services/draw/utils";
import {
    ValidateInteractValid,
    ValidateYankValid,
} from "~/simulation/server/types";
import { WorldEntity, Player, Vec2 } from "~/types/worldTypes";

export function pickUpObject(entity: WorldEntity, player: Player) {
    player.carryingObjId = entity.id;
    entity.pos = undefined;
    return true;
}

// TODO: if object is an item-wrapper, remove the object; it will get placed when placing the item
export function pickUpItem(entity: WorldEntity, player: Player) {
    const isItemWrapper = entity.type === "ITEM_ENTITY";

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
    console.assert(prevLength, "player should have items!", player.itemIds);

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

function applyYankCommand(
    player: Player,
    action: VimAction,
    result: ValidateYankValid,
) {
    // move player into position
    player.pos = result.pos;
    const modifier = action.command?.[1];

    // attempt to pick up item
    switch (modifier) {
        case "a":
            // "around" e.g. pick up the object??
            if (player.carryingObjId) return false; // already carrying
            if (!result.obj.liftable?.canCarry) return false; // not liftable
            return pickUpObject(result.obj, player);
        case "i":
            // "inside" e.g. pick up the item within the object
            if (!entityHasItem(result.obj)) return false;
            return pickUpItem(result.obj, player);
        default:
            return false;
    }
}

function applyPasteCommand(
    player: Player,
    action: VimAction,
    result: ValidateInteractValid,
) {
    const modifier = action.command![1] as ModifierKey;
    console.log(result);
    if (result.obj === undefined) return false;
    switch (modifier) {
        case "a":
            return placeObject(result.obj, player, result.pos!);
        case "i":
            console.assert(
                result.obj !== undefined,
                "missing object!!!",
                result,
            );
            return placeItem(result.obj, player);
        default:
            return false;
    }
}

// type ReturnTypes = {
//     y: {
//         a: ValidateYankResult;
//         i: ValidateYankResult;
//     };
//     p: {
//         a: ValidatePasteResult;
//         i: ValidateYankResult;
//     };
//     d: {
//         a: ValidateYankResult;
//         i: ValidateYankResult;
//     };
//     c: {
//         a: ValidateYankResult;
//         i: ValidateYankResult;
//     };
//     basic: BasicInteractValidationResult;
// };

// type Target = {
//         targetObj: WorldEntity;
//         lastPosBeforeObject: Vec2;
//     }

const interact: Record<
    OperatorKey,
    (
        player: Player,
        action: VimAction,
        result: ValidateInteractValid,
    ) => boolean
> = {
    y: applyYankCommand,
    p: applyPasteCommand,
    c: applyYankCommand, // TODO:
    d: applyYankCommand, // TODO:
};
export default interact;
