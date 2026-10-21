import { ExpandedVimAction } from "~/fsm/types";
import { ClientActionMessage } from "~/types/wss/client";
import { MOVEMENT_CONFIG } from "./loop";

export function expandAction({seq, action, clientTime}: Pick<ClientActionMessage, 'seq' | 'action' | 'clientTime'>, prevSeq: number) {
    const totalSteps = Math.min(MOVEMENT_CONFIG.MAX_MACRO_COUNT, action.count ?? 1); // TODO: limit by level or something
    const parts = Math.ceil(totalSteps / MOVEMENT_CONFIG.maxCountPerTick);

    // e.g. 10j =>
    //      4 parts of 3 + 1
    // i = 0, 1, 2, 3

const expanded = Array.from<unknown, ExpandedVimAction>({ length: parts }, (_, i) => ({
        type: action.type,
        ...(action.key ? {
            key: action.key,
        } : {}),
        ...(action.command ? {
            command: action.command,
        } : {}),
        clientTime,
        count: Math.min(
            MOVEMENT_CONFIG.maxCountPerTick,
            totalSteps - i * MOVEMENT_CONFIG.maxCountPerTick,
        ),
        remaining: parts - 1 - i,
        finalSeq: seq,
        seq: i === parts - 1
            ? seq // last sends current seq
            : prevSeq, // partials send prev seq aka lastProcessedSeq
    }));

    return expanded;
}

// const TEST_PROPS = {
//     seq: 1, action: {
//         type: 'MOVE' as VimActionType,
//         key: 'j',
//         count: 10,
//         seq: 1
//     }, clientTime: 1,
// }
// const result = expandAction(TEST_PROPS, 0);
// console.log('test result expand action::', {TEST_PROPS, result});
// console.assert(result.length === 4, 'expected 4 parts!!', result.length);
// console.assert(result[0].count === 3, 'expected first to have 3 count!', result[0].count);
// console.assert(result[3].count === 1, 'expected last to have 1 count!', result[3].count);

