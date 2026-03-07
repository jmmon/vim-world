import { ActionResult, LocalWorldWrapper } from "~/components/canvas1/types";
import {
    ModifierKey,
    OperatorKey,
    TargetKey,
    VimAction,
} from "../../fsm/types";
import { basicInteractValidation } from "../shared/validators/interact";
import applies from "../shared/actions";
import sharedValidators from "../shared/validators";

// e.g. if ya then pick up the object, if yi then try to get the item inside the object if there is one
// some objects could be liftable and others not
// could also allow pushing them?? e.g. if pushing, process movement every 4 ticks or something
// could allow sliding of the player!!! e.g. from x to x + 1 over some time, and if you stop pressing the key or didn't do high enough count, it will reset yours and the object's positioning

export function applyInteraction(
    state: LocalWorldWrapper,
    action: VimAction,
): ActionResult {
    if (!state.physics.prediction) return { reason: undefined, isDirty: false };

    const basicResult = basicInteractValidation(action);

    if (!basicResult.ok) return { reason: basicResult.reason, isDirty: false };

    const [actionType, modifier, target] = [
        action.command![0],
        action.command![1],
        action.command![2],
    ] as [OperatorKey, ModifierKey, TargetKey];

    const interactValidatorResult = sharedValidators.interact[actionType][
        modifier
    ](state, state.client.player!, target);
    if (!interactValidatorResult || !interactValidatorResult?.ok)
        return { reason: interactValidatorResult.reason, isDirty: false };

    applies.interact[actionType](
        state.client.player!,
        action,
        interactValidatorResult,
    );

    if (interactValidatorResult.ok)
        return {
            reason: interactValidatorResult.reason,
            isDirty: { players: true, objects: true },
        };
    return { reason: undefined, isDirty: false };
}
