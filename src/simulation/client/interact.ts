import { IsDirty, LocalWorldWrapper } from "~/components/canvas1/types";
import { ModifierKey, OperatorKey, TargetKey, VimAction } from "../../fsm/types";
import { ValidatePasteValid, ValidateYankValid } from "../server/types";
import { basicInteractValidation } from "../shared/validators/interact";
import applies from "../shared/actions";
import sharedValidators from "../shared/validators";

// e.g. if ya then pick up the object, if yi then try to get the item inside the object if there is one
// some objects could be liftable and others not
// could also allow pushing them?? e.g. if pushing, process movement every 4 ticks or something
// could allow sliding of the player!!! e.g. from x to x + 1 over some time, and if you stop pressing the key or didn't do high enough count, it will reset yours and the object's positioning

export async function applyInteraction(
    state: LocalWorldWrapper,
    action: VimAction,
): Promise<Partial<IsDirty> | false> {
    const prediction = await state.getPhysicsPrediction();
    if (!prediction) return false;

    const basicResult = basicInteractValidation(action);

    if (!basicResult.ok) return false;


    const actionType = action.command![0] as OperatorKey;
    const modifier = action.command![1] as ModifierKey
    const target = action.command![2] as TargetKey;

    const interactValidatorResult = await sharedValidators.interact[actionType][modifier](state, state.client.player!, target);
    if (!interactValidatorResult || !interactValidatorResult?.ok) return false;

    if (actionType === 'p') {
        await applies.interact[actionType](state, state.client.player!, action, interactValidatorResult as ValidatePasteValid)
    } else {
        await applies.interact[actionType](state, state.client.player!, action, interactValidatorResult as ValidateYankValid)
    }
    if (interactValidatorResult.ok) return { players: true, objects: true };
    return false;
}


