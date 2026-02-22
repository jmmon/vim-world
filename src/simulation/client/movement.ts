import { IsDirty, LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { addPos, keyToDelta, deltaToDir } from "~/simulation/shared/helpers";
import chunkService from "~/services/chunk";
import { Player, Vec2 } from "~/types/worldTypes";
import { MapConfig } from "~/server/map";


export function setPlayerPos(player: Player, next: Vec2, mapConfig: MapConfig): boolean {
    const prev = { ...player.pos };
    player.pos.x = next.x;
    player.pos.y = next.y;

    const isSame = chunkService.isSameChunkByPos(prev, next);
    console.log('setPlayerPos:', {isSameChunk: isSame});
    if (!isSame) chunkService.handleChunkChange(player, mapConfig);
    return !isSame;
}

export async function applyMoveAction(
    state: LocalWorldWrapper,
    action: VimAction,
): Promise<IsDirty | false> {
    if (!state.physics.prediction) return false;

    const delta = keyToDelta(action.key);
    if (!delta) return false;

    const steps = action.count ?? 1;
    const p = state.client.player!;
    p.dir = deltaToDir(delta); // commit facing change

    let next: Vec2 = p.pos;
    let processed = 0;
    for (; processed < steps; processed++) {
        const nextTry = addPos(next, delta);
        // console.log({processed, next});

        if (!(await state.isWithinBounds(nextTry))) {
            console.error("not within bounds!", p.pos, nextTry);
            break; // stop at map edge
        }

        if (!(await state.isWalkable(nextTry))) {
            break; // stop at obstacle or player
        }

        next = nextTry;
    }
    const changed = setPlayerPos(p, next, state.world.config); // commit step

    return {
        players: (processed > 0),
        map: changed,
        objects: changed,
    };
};




