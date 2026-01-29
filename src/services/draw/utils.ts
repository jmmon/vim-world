import { LocalWorldWrapper, MapDimensions } from "../../components/canvas1/types";

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
        const { canvasWidth, canvasHeight } = generateOldDimensions(
            state.world,
        );
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
}

export function generateOldDimensions(
    world: LocalWorldWrapper["world"],
): MapDimensions {
    const tileSize = world.dimensions.tileSize * world.lastScale;
    return {
        width: world.dimensions.width,
        height: world.dimensions.height,
        tileSize,
        canvasWidth: tileSize * world.dimensions.width,
        canvasHeight: tileSize * world.dimensions.width,
        scale: world.lastScale,
    };
}
