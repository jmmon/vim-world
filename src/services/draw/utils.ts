import { MapDimensions, WorldEntity } from "~/types/worldTypes";
import { LocalWorldWrapper } from "../../components/canvas1/types";
import { GameState } from "~/hooks/useState";
import { CHUNK_SIZE } from "~/server/map";

export const getScaledTileSize = (scaleDecimal: number) => {
    const tileSize = Math.round(CHUNK_SIZE * scaleDecimal);
    const actualScale = tileSize / CHUNK_SIZE;

    return { tileSize, actualScale };
}

const COMPARE_GRANULARITY = 1000;
export function hasScaleChanged(state: LocalWorldWrapper) {
    return (
        0 !==
        Math.round(
            (state.world.dimensions.scale - state.world.lastScale) *
                COMPARE_GRANULARITY,
        ) /
            COMPARE_GRANULARITY
    );
}

export function closeOldCanvas(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    // clear old rect
    if (hasScaleChanged(state)) {
        const { viewportWidthPx, viewportHeightPx } = generateOldDimensions(
            state.world,
        );
        ctx.clearRect(0, 0, viewportWidthPx, viewportHeightPx);
    }
}

export function generateOldDimensions(
    world: LocalWorldWrapper["world"],
): MapDimensions {
    const tileSize = world.dimensions.tileSize * world.lastScale;
    return {
        worldWidthBlocks: world.dimensions.worldWidthBlocks,
        worldHeightBlocks: world.dimensions.worldHeightBlocks,
        tileSize,
        viewportWidthPx: tileSize * world.dimensions.worldWidthBlocks,
        viewportHeightPx: tileSize * world.dimensions.worldWidthBlocks,
        viewportWidthBlocks: CHUNK_SIZE,
        viewportHeightBlocks: CHUNK_SIZE,
        scale: world.lastScale,
    };
}

export function entityHasItem(obj: WorldEntity): obj is WorldEntity {
    return !!(obj.container && obj.container.itemIds.length > 0);
}

export function shadeColor(color: string, percent: number /** 0-100 */) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = (R * (100 + percent)) / 100;
    G = (G * (100 + percent)) / 100;
    B = (B * (100 + percent)) / 100;

    R = Math.min(255, Math.round(R));
    G = Math.min(255, Math.round(G));
    B = Math.min(255, Math.round(B));

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return "#" + RR + GG + BB;
}


export function clearAll(state: GameState) {
    const { viewportWidthPx: canvasWidth, viewportHeightPx: canvasHeight } = generateOldDimensions(
        state.ctx.world,
    );
    [[canvasWidth, canvasHeight], [state.ctx.world.dimensions.viewportWidthPx, state.ctx.world.dimensions.viewportHeightPx]].forEach((canvasSize) => {
        state.refs.map.value!.getContext("2d")!.clearRect(0, 0, canvasSize[0], canvasSize[1]);
        state.refs.objects.value!.getContext("2d")!.clearRect(0, 0, canvasSize[0], canvasSize[1]);
        state.refs.players.value!.getContext("2d")!.clearRect(0, 0, canvasSize[0], canvasSize[1]);
        state.refs.overlay.value!.getContext("2d")!.clearRect(0, 0, canvasSize[0], canvasSize[1]);
    });
}

