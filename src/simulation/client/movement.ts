import { LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { OPTS, Opts} from "./actions";
import { combinePos, keyToDelta, updateDirection } from "./helpers";


export async function applyMoveAction(
    state: LocalWorldWrapper,
    action: VimAction,
    opts?: Partial<Opts>,
) {
    const { prediction, collision }: Opts = {
        ...OPTS,
        ...opts,
    };
    if (!prediction) return false;

    const delta = keyToDelta(action.key);
    if (!delta) return false;

    const steps = action.count ?? 1;
    const p = state.client.player!;
    updateDirection(p, delta); // always update direction even if they didn't move

    let processed = 0;
    for (; processed < steps; processed++) {
        const next = combinePos(p.pos, delta);
        // console.log({processed, next});

        if (collision && (await state.isWithinBounds(next))) {
            console.error("not within bounds!", p.pos, next);
            break; // stop at map edge
        }

        if (collision && (await state.isWalkable(next))) {
            break; // stop at obstacle or player
        }

        p.pos = next; // commit step
    }
    // console.log({processed, p});
    return {
        players: (processed > 0)
    };
};




