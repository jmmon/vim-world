import {
    CommandVimAction,
    VimAction,
} from "../../fsm/types";
import { LocalWorldWrapper } from "~/simulation/client/types";
import { ActionResult } from "~/simulation/types";;
import { applyMoveAction } from "./movement";
import { applyCommandAction } from "./command";
import { applyInteraction } from "./interact";

/**
 * doesn't draw anything, only runs collision and updates world state
 * */
export function applyActionToWorld(
    ctx: LocalWorldWrapper,
    action: VimAction,
): ActionResult {
    // console.log('applyActionToWorld called with::', {ctx, action})

    // basic validation first?? of action: "INVALID_ACTION"
    switch (action.type) {
        case "MOVE":
            return applyMoveAction(ctx, action);
        case "INTERACT":
            return applyInteraction(ctx, action);
        case "COMMAND_PROMPT":
        case "COMMAND_PARTIAL":
        case "COMMAND_LINE":
        case "COMMAND":
            return applyCommandAction(ctx, action as CommandVimAction);
        default:
            return { reason: "UNHANDLED", isDirty: false, };
    }
}


