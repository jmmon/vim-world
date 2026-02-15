import { IsDirty, LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { combinePos, keyToDelta, deltaToDir } from "~/simulation/shared/helpers";
import { getChunkSlot } from "~/server/map";


export async function applyMoveAction(
    state: LocalWorldWrapper,
    action: VimAction,
): Promise<IsDirty | false> {
    const prediction = await state.getPhysicsPrediction();
    if (!prediction) return false;

    const collision = await state.getPhysicsCollision();

    const delta = keyToDelta(action.key);
    if (!delta) return false;

    const steps = action.count ?? 1;
    const p = state.client.player!;
    p.dir = deltaToDir(delta); // always update direction even if they didn't move

    const prevChunk = getChunkSlot(p.pos);
    let nextChunk = prevChunk;

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
        nextChunk = getChunkSlot(next);
    }

    const hasChunkChanged = prevChunk.chunkX - nextChunk.chunkX !== 0 || prevChunk.chunkY - nextChunk.chunkY !== 0;
    return {
        players: (processed > 0),
        map: hasChunkChanged,
        objects: hasChunkChanged,
    };
};




