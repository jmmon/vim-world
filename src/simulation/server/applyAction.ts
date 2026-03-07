import { Player, ServerPlayer } from "~/types/worldTypes";
import applies from "~/simulation/shared/actions";
import { ModifierKey, OperatorKey, TargetKey, ExpandedVimAction, VimActionType } from "~/fsm/types";
import serverValidators from "./validators";
import { ServerWorldWrapper } from "~/server/types";
import { applyCommandToPlayerCommandState } from "../shared/actions/command";
import { ActionResult } from "~/components/canvas1/types";
import { isValidMove } from "../shared/helpers";
import { ValidateMoveCorrection, ValidateMoveValid } from "./types";

function movePlayer(player: Player, result: ValidateMoveValid | ValidateMoveCorrection) {
    player.pos.x = result.target.x;
    player.pos.y = result.target.y;
    player.dir = result.dir ?? player.dir;
}
function applyMoveToServerWorld(ctx: ServerWorldWrapper, player: Player, action: ExpandedVimAction): ActionResult['reason'] {
    const result = serverValidators.move(ctx, player, action);
    if (isValidMove(result)) movePlayer(player, result);
    return result.reason;
}

function applyInteractToServerWorld(ctx: ServerWorldWrapper, player: Player, action: ExpandedVimAction): ActionResult['reason'] {
    const basicResult = serverValidators.interact.basic(action);
    if (!basicResult.ok) return basicResult.reason;

    const [actionType, modifier, target] = action.command!.split('') as [ OperatorKey, ModifierKey, TargetKey ];
    const result = serverValidators.interact[actionType][modifier](ctx, player, target);

     // 'OUT_OF_BOUNDS' | 'COLLISION' | 'INVALID_KEY' | 'INVALID_ACTION'
    if (!result || !result?.ok) return result.reason;
    applies.interact[actionType](player, action, result)

    return undefined;
}

function applyTargetToServerWorld(world: ServerWorldWrapper, player: ServerPlayer, action: ExpandedVimAction) {
    console.log('"TARGET" !!Not yet implemented...');
    return 'INVALID_ACTION' as ActionResult["reason"];
}
export const serverApplyAction: Record<VimActionType, (world: ServerWorldWrapper, player: ServerPlayer, action: ExpandedVimAction) => ActionResult['reason']> = {
    "MOVE": applyMoveToServerWorld,
    "INTERACT": applyInteractToServerWorld,
    "COMMAND": applyCommandToPlayerCommandState,
    "COMMAND_PARTIAL": applyCommandToPlayerCommandState,
    "COMMAND_PROMPT": applyCommandToPlayerCommandState,
    "TARGET": applyTargetToServerWorld,
}


