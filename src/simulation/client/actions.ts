import {
    VimAction,
} from "../../fsm/types";
import { ApplyActionDirtyResult, LocalWorldWrapper, MaybePromise } from "~/components/canvas1/types";
import { applyMoveAction } from "./movement";
import { applyCommandAction } from "./command";
import { applyInteraction } from "./interact";


/**
 * doesn't draw anything, only runs collision and updates world state
 * */
export function applyActionToWorld(
    localWorldWrapper: LocalWorldWrapper,
    action: VimAction,
): MaybePromise<ApplyActionDirtyResult> {
    switch (action.type) {
        case "MOVE":
            return applyMoveAction(localWorldWrapper, action);
        case "INTERACT":
            return applyInteraction(localWorldWrapper, action);
        case "COMMAND_PROMPT":
        case "COMMAND_PARTIAL":
        case "COMMAND":
            return applyCommandAction(localWorldWrapper, action);
        default:
            return false;
    }
}


