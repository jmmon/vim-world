import { MapDimensions, WorldEntity } from "~/types/worldTypes";
import { LocalWorldWrapper } from "../../components/canvas1/types";

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

export function entityHasItem(obj: WorldEntity): obj is WorldEntity {
    return !!(obj.container && obj.container.itemIds.length > 0);
}

export function shadeColor(color: string, percent: number /** 0-100 */) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(String((R * (100 + percent)) / 100));
    G = parseInt(String((G * (100 + percent)) / 100));
    B = parseInt(String((B * (100 + percent)) / 100));

    R = R < 255 ? Math.round(R) : 255;
    G = G < 255 ? Math.round(G) : 255;
    B = B < 255 ? Math.round(B) : 255;

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return "#" + RR + GG + BB;
}


