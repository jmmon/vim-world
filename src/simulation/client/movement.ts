import {
    ActionResult,
    LocalWorldWrapper,
} from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import chunkService from "~/services/chunk";
import viewport from "./viewport";
import sharedValidators from "../shared/validators";
import { ValidateMoveCorrection, ValidateMoveValid } from "../server/types";
import { isValidMove } from "../shared/helpers";

/** @returns isSameChunk */
export function updatePlayerMovement(
    state: LocalWorldWrapper,
    {
        target,
        dir,
    }: Pick<ValidateMoveValid | ValidateMoveCorrection, "target" | "dir">,
): boolean {
    state.client.player!.dir = dir ?? state.client.player!.dir;
    const prev = { ...state.client.player!.pos };
    state.client.player!.pos.x = target.x;
    state.client.player!.pos.y = target.y;

    const isSameChunk = chunkService.isSameChunkByPos(prev, target);
    if (!isSameChunk)
        chunkService.handleVisibleChunksChange(
            state.client.player!.pos,
            state.world.config,
        );
    return isSameChunk;
}

function movePlayer(
    state: LocalWorldWrapper,
    result: ValidateMoveValid | ValidateMoveCorrection,
) {
    const isSameChunk = updatePlayerMovement(state, result); // commit step
    const viewportChanged = viewport.updatePos(state);

    return {
        players: !!(result?.processedCount && result.processedCount > 0),
        overlay: !isSameChunk,
        map: viewportChanged,
        objects: viewportChanged,
    };
}

export function applyMoveAction(
    state: LocalWorldWrapper,
    action: VimAction,
): ActionResult {
    const actionResult: ActionResult = {
        reason: undefined,
        isDirty: false,
    };
    if (!state.physics.prediction) return actionResult;

    const p = state.client.player!;
    const prevDir = p.dir;
    const result = sharedValidators.move(state, p, action);

    actionResult.reason = result.reason;
    actionResult.isDirty = {
        players: prevDir !== p.dir,
    };

    if (isValidMove(result)) {
        actionResult.isDirty = movePlayer(state, result);
        actionResult.isDirty.players ||= prevDir !== p.dir;
    }

    return actionResult;
}

