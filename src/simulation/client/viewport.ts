import { LocalWorldWrapper, Viewport } from "~/components/canvas1/types";
import { MapConfig } from "~/server/map";
import { Vec2 } from "~/types/worldTypes";
import { subtractPos } from "../shared/helpers";
import { GameState } from "~/hooks/useState";

function snapViewport(
    state: LocalWorldWrapper,
    viewportDeltaPx: Vec2,
): boolean {
    const { config } = state.world;
    const { viewport } = state.client;
    // console.log("checking to snap...");
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
) {
    const { tileSize, worldWidthPx, worldHeightPx } = config;
    if (viewportDeltaPx.x < offset.x && viewport.origin.x > 0) {
        // console.log("should scroll left");
        return true;
    }
    if (viewportDeltaPx.y < offset.y && viewport.origin.y > 0) {
        // console.log("should scroll up");
        return true;
    }
    if (
        viewportDeltaPx.x >= viewport.width - (offset.x + tileSize) &&
        viewport.origin.x < worldWidthPx - viewport.width
    ) {
        // console.log("should scroll right");
        return true;
    }
    if (
        viewportDeltaPx.y >= viewport.height - (offset.y + tileSize) &&
        viewport.origin.y < worldHeightPx - viewport.height
    ) {
        // console.log("should scroll down");
        return true;
    }
    return false;
}


// function getIsOutsideViewport2(
//     config: MapConfig,
//     viewport: Viewport,
//     viewportDeltaPx: Vec2,
//     offset: Vec2,
// ) {
//     const { tileSize, worldWidthPx, worldHeightPx } = config;
//     const diff = subtractPos(viewportDeltaPx, offset);
//     const sum = addPos(viewportDeltaPx, offset);
//     const canScrollLeft = viewport.origin.x > 0;
//     const canScrollUp = viewport.origin.y > 0;
//     const canScrollRight = viewport.origin.x < worldWidthPx - viewport.width;
//     const canScrollDown = viewport.origin.y < worldHeightPx - viewport.height;
//
//     // if (viewportDeltaPx.x < offset.x && viewport.origin.x > 0) {
//     if (canScrollLeft && diff.x > 0) {
//         // console.log("should scroll left");
//         return true;
//     }
//     // // if (viewportDeltaPx.y < offset.y && viewport.origin.y > 0) {
//     if (canScrollUp && diff.y > 0) {
//         // console.log("should scroll up");
//         return true;
//     }
//     // // viewportDeltaPx.x >= viewport.width - (offset.x + tileSize) &&
//     if (canScrollRight && sum.x >= viewport.width - tileSize) {
//         // console.log("should scroll right");
//         return true;
//     }
//     // // viewportDeltaPx.y >= viewport.height - (offset.y + tileSize) &&
//     if (canScrollDown && sum.y >= viewport.height - tileSize) {
//         // console.log("should scroll down");
//         return true;
//     }
//     return false;
// }


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
    const offsetPx = {
        x: sidescrolloff * tileSize,
        y: scrolloff * tileSize,
    }
    const shouldScroll = getIsOutsideViewport(
        state.world.config,
        viewport,
        viewportDeltaPx,
        offsetPx,
    );

    // console.log("checking to scroll...", {
    //     scrolloff,
    //     sidescrolloff,
    //     xOffset,
    //     yOffset,
    //     viewport,
    //     playerPx,
    //     isOutsideViewport,
    // });

    if (!shouldScroll) return false;

    // console.log("outside viewport! expect a scroll");
    if (viewportDeltaPx.x < offsetPx.x) {
        state.client.viewport.origin.x = Math.max(0, playerPx.x - offsetPx.x);
    }
    if (viewportDeltaPx.y < offsetPx.y) {
        state.client.viewport.origin.y = Math.max(0, playerPx.y - offsetPx.y);
    }
    if (
        viewportDeltaPx.x >=
        state.client.viewport.width - (offsetPx.x + tileSize)
    ) {
        state.client.viewport.origin.x =
            -viewport.width +
            Math.min(worldWidthPx, playerPx.x + offsetPx.x + tileSize);
    }
    if (
        viewportDeltaPx.y >=
        state.client.viewport.height - (offsetPx.y + tileSize)
    ) {
        state.client.viewport.origin.y =
            -viewport.height +
            Math.min(worldHeightPx, playerPx.y + offsetPx.y + tileSize);
    }
    return true;
}


// function scrollViewport2(
//     state: LocalWorldWrapper,
//     playerPx: Vec2,
//     viewportDeltaPx: Vec2,
// ): boolean {
//     const { tileSize, worldWidthPx, worldHeightPx } = state.world.config;
//     const {
//         viewport,
//         settings: { sidescrolloff, scrolloff },
//     } = state.client;
//     const offsetPx = {
//         x: sidescrolloff * tileSize,
//         y: scrolloff * tileSize,
//     }
//     const shouldScroll = getIsOutsideViewport2(
//         state.world.config,
//         viewport,
//         viewportDeltaPx,
//         offsetPx,
//     );
//
//     // console.log("checking to scroll...", {
//     //     scrolloff,
//     //     sidescrolloff,
//     //     xOffset,
//     //     yOffset,
//     //     viewport,
//     //     playerPx,
//     //     isOutsideViewport,
//     // });
//
//     if (!shouldScroll) return false;
//
//     const playerDiff = subtractPos(playerPx, offsetPx);
//     const playerSum = addPos(playerPx, offsetPx);
//     // console.log("outside viewport! expect a scroll");
//     if (viewportDeltaPx.x < offsetPx.x) {
//         state.client.viewport.origin.x = Math.max(0, playerDiff.x);
//     }
//     if (viewportDeltaPx.y < offsetPx.y) {
//         state.client.viewport.origin.y = Math.max(0, playerDiff.y);
//     }
//     if (
//         viewportDeltaPx.x >=
//         state.client.viewport.width - (offsetPx.x + tileSize)
//     ) {
//         // console.log("scrolling right");
//         state.client.viewport.origin.x =
//             -viewport.width +
//             Math.min(worldWidthPx, playerSum.x + tileSize);
//     }
//     if (
//         viewportDeltaPx.y >=
//         state.client.viewport.height - (offsetPx.y + tileSize)
//     ) {
//         state.client.viewport.origin.y =
//             -viewport.height +
//             Math.min(worldHeightPx, playerSum.y + tileSize);
//     }
//     return true;
// }


// TODO: in full-prediction, viewport works as expected
// - in VISUAL_ONLY, the viewport is ending up at the expected position without accounting for collision!!!!
// - need to make sure the onServerAck will propery fix the viewport
//
// this belongs more in a Camera folder or Viewport or somewhere else
function updateViewportPos(state: LocalWorldWrapper): boolean {
    const player = state.client.player;
    if (!player) return false;

    const { tileSize } = state.world.config;
    const playerPx = {
        x: player.pos.x * tileSize,
        y: player.pos.y * tileSize,
    };
    const viewportDeltaPx = subtractPos(playerPx, state.client.viewport.origin);

    if (
        state.client.settings.scrolloff ||
        state.client.settings.sidescrolloff
    ) {
        return scrollViewport(state, playerPx, viewportDeltaPx);
    }
    return snapViewport(state, viewportDeltaPx);
}

function updateViewportDimensions(ctx: LocalWorldWrapper) {
    const { lines, columns } = ctx.client.settings;
    const { tileSize } = ctx.world.config;
    const prev = { ...ctx.client.viewport };

    // console.log("setting viewport width/height...");
    ctx.client.viewport.width = columns * tileSize;
    ctx.client.viewport.height = lines * tileSize;

    const hasChanged =
        prev.height !== ctx.client.viewport.height ||
        prev.width !== ctx.client.viewport.width;

    return hasChanged;
}

function updateCanvasDimensions(state: GameState) {
    // console.log("new viewport:", this.ctx.client.viewport);
    state.refs.container.value!.style.width =
        state.refs.map.value!.style.width =
        state.refs.objects.value!.style.width =
        state.refs.players.value!.style.width =
        state.refs.overlay.value!.style.width =
            state.ctx.client.viewport.width + "px";
    state.refs.container.value!.style.height =
        state.refs.map.value!.style.height =
        state.refs.objects.value!.style.height =
        state.refs.players.value!.style.height =
        state.refs.overlay.value!.style.height =
            state.ctx.client.viewport.height + "px";
}

const viewport = {
    updatePos: updateViewportPos,
    updateDimensions: updateViewportDimensions,
    updateCanvas: updateCanvasDimensions,
};
export default viewport;
