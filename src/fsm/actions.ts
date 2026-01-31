import {
    VimAction,
} from "./types";
import { applyCommandAction, applyInteraction, applyMoveAction } from "./movement";
import { LocalWorldWrapper } from "~/components/canvas1/types";

/**
 * doesn't draw anything, only runs collision and updates world state
 * */
export function applyActionToWorld(
    localWorldWrapper: LocalWorldWrapper,
    action: VimAction,
    opts?: Partial<{
        collision: boolean,
        prediction: boolean,
    }>,
): Promise<boolean> | boolean {
    switch (action.type) {
        case "MOVE":
            return applyMoveAction(localWorldWrapper, action, opts);
        case "COMMAND":
            return applyCommandAction(localWorldWrapper, action);
        case "INTERACT":
            return applyInteraction(localWorldWrapper, action, opts);
        default:
            return false;
    }
}


