import {
    IsDirty,
    LocalWorldWrapper,
    Viewport,
} from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import {
    addPos,
    keyToDelta,
    deltaToDir,
    subtractPos,
} from "~/simulation/shared/helpers";
import chunkService from "~/services/chunk";
import { Vec2 } from "~/types/worldTypes";
import { MapConfig } from "~/server/map";

function snapViewport(
    state: LocalWorldWrapper,
    viewportDeltaPx: Vec2,
): boolean {
    const { config } = state.world;
    const { viewport } = state.client;
    console.log("checking to snap...");
    if (viewportDeltaPx.x < 0) {
        state.client.viewport.origin.x = Math.max(
            0,
            viewport.origin.x - viewport.width,
        );
        return true;
    }
    if (viewportDeltaPx.y < 0) {
        state.client.viewport.origin.y = Math.max(
            0,
            viewport.origin.y - viewport.height,
        );
        return true;
    }
    if (viewportDeltaPx.x >= viewport.width) {
        state.client.viewport.origin.x = Math.min(
            config.worldWidthPx - viewport.width,
            viewport.origin.x + viewport.width,
        );
        return true;
    }
    if (viewportDeltaPx.y >= viewport.height) {
        state.client.viewport.origin.y = Math.min(
            config.worldHeightPx - viewport.height,
            viewport.origin.y + viewport.height,
        );
        return true;
    }
    return false;
}

function getIsOutsideViewport(
    config: MapConfig,
    viewport: Viewport,
    viewportDeltaPx: Vec2,
    offset: Vec2,
): boolean {
    const { tileSize, worldWidthPx, worldHeightPx } = config;
    if (viewportDeltaPx.x < offset.x && viewport.origin.x > 0) {
        console.log("should scroll left");
        return true;
    }
    if (viewportDeltaPx.y < offset.y && viewport.origin.y > 0) {
        console.log("should scroll up");
        return true;
    }
    if (
        viewportDeltaPx.x >= viewport.width - (offset.x + tileSize) &&
        viewport.origin.x < worldWidthPx - viewport.width
    ) {
        console.log("should scroll right");
        return true;
    }
    if (
        viewportDeltaPx.y >= viewport.height - (offset.y + tileSize) &&
        viewport.origin.y < worldHeightPx - viewport.height
    ) {
        console.log("should scroll down");
        return true;
    }
    return false;
}

// currently is toggling back and forth..
// currently is snapping viewport
function scrollViewport(
    state: LocalWorldWrapper,
    playerPx: Vec2,
    viewportDeltaPx: Vec2,
): boolean {
    const { tileSize, worldWidthPx, worldHeightPx } = state.world.config;
    const {
        viewport,
        settings: { sidescrolloff, scrolloff },
    } = state.client;
    const xOffset = sidescrolloff * tileSize;
    const yOffset = scrolloff * tileSize;
    const isOutsideViewport = getIsOutsideViewport(
        state.world.config,
        viewport,
        viewportDeltaPx,
        { x: xOffset, y: yOffset },
    );
    // const isOutsideViewport =
    //     (viewportDeltaPx.x < xOffset && viewport.origin.x > 0) ||
    //     (viewportDeltaPx.y < yOffset && viewport.origin.y > 0) ||
    //     (viewportDeltaPx.x >=
    //         state.client.viewport.width - (xOffset + tileSize) &&
    //         viewport.origin.x < worldWidthPx - state.client.viewport.width) ||
    //     (viewportDeltaPx.y >=
    //         state.client.viewport.height - (yOffset + tileSize) &&
    //         viewport.origin.y < worldHeightPx - state.client.viewport.height);

    console.log("checking to scroll...", {
        scrolloff,
        sidescrolloff,
        xOffset,
        yOffset,
        viewport,
        playerPx,
        isOutsideViewport,
    });

    if (!isOutsideViewport) return false;

    console.log("outside viewport! expect a scroll");
    if (viewportDeltaPx.x < xOffset) {
        state.client.viewport.origin.x = Math.max(0, playerPx.x - xOffset);
    }
    if (viewportDeltaPx.y < yOffset) {
        state.client.viewport.origin.y = Math.max(0, playerPx.y - yOffset);
    }
    if (
        viewportDeltaPx.x >=
        state.client.viewport.width - (xOffset + tileSize)
    ) {
        console.log("scrolling right");
        state.client.viewport.origin.x =
            -viewport.width +
            Math.min(worldWidthPx, playerPx.x + (xOffset + tileSize));
    }
    if (
        viewportDeltaPx.y >=
        state.client.viewport.height - (yOffset + tileSize)
    ) {
        state.client.viewport.origin.y =
            -viewport.height +
            Math.min(worldHeightPx, playerPx.y + (yOffset + tileSize));
    }
    return true;
}

// TODO: in full-prediction, viewport works as expected
// - in VISUAL_ONLY, the viewport is ending up at the expected position without accounting for collision!!!!
// - need to make sure the onServerAck will propery fix the viewport
//
// this belongs more in a Camera folder or Viewport or somewhere else
export function updateViewportPos(state: LocalWorldWrapper): boolean {
    const player = state.client.player;
    if (!player) return false;

    const { tileSize } = state.world.config;
    const playerPx = {
        x: player.pos.x * tileSize,
        y: player.pos.y * tileSize,
    };
    const viewportDeltaPx = subtractPos(playerPx, state.client.viewport.origin);
    console.log("checking viewport:: expect player at corrected pos!::", {
        viewport: { ...state.client.viewport },
        originCells: {
            x: state.client.viewport.origin.x / tileSize,
            y: state.client.viewport.origin.y / tileSize,
        },
        player: { ...player, pos: { ...player.pos } },
        viewportDeltaPx,
        prevPlayerPx: playerPx,
    });

    if (
        state.client.settings.scrolloff ||
        state.client.settings.sidescrolloff
    ) {
        const result = scrollViewport(
            state,
            playerPx,
            viewportDeltaPx,
        );
        if (result)
            console.log("~~ viewport scrolled::", {
                ...state.client.viewport,
                origin: { ...state.client.viewport.origin },
            });
        return result;
    }
    const result = snapViewport(state, viewportDeltaPx);
    if (result)
        console.log("~~ viewport snapped::", {
            ...state.client.viewport,
            origin: { ...state.client.viewport.origin },
        });
    return result;
}

/** @returns isSameChunk */
export function setPlayerPos(state: LocalWorldWrapper, next: Vec2): boolean {
    const prev = { ...state.client.player!.pos };
    state.client.player!.pos.x = next.x;
    state.client.player!.pos.y = next.y;

    const isSameChunk = chunkService.isSameChunkByPos(prev, next);
    console.log("setPlayerPos:", { isSameChunk, prev, next });
    if (!isSameChunk)
        chunkService.handleVisibleChunksChange(
            state.client.player!.pos,
            state.world.config,
        );
    return isSameChunk;
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

    // console.log("updating dir...");
    const prevDir = p.dir;
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
    const isSameChunk = setPlayerPos(state, next); // commit step
    const viewportChanged = updateViewportPos(state);

    return {
        overlay: !isSameChunk,
        players: prevDir !== p.dir || processed > 0,
        map: viewportChanged,
        objects: viewportChanged,
    };
}
