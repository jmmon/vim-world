import {
    VimAction,
} from "../../fsm/types";
import { LocalWorldWrapper } from "~/components/canvas1/types";
import { applyMoveAction } from "./movement";
import { applyCommandAction } from "./command";
import { applyInteraction } from "./interact";

export type Opts = {
    collision: boolean;
    prediction: boolean;
};
export const OPTS = {
    collision: true,
    prediction: true,
};

type IsDirty = {
    players?: boolean,
    objects?: boolean,
    map?: boolean,
} | false;
/**
 * doesn't draw anything, only runs collision and updates world state
 * */
export function applyActionToWorld(
    localWorldWrapper: LocalWorldWrapper,
    action: VimAction,
    opts?: Partial<Opts>,
): Promise<IsDirty> | IsDirty {
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


