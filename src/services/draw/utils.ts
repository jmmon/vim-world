import { WorldEntity } from "~/types/worldTypes";
import { LocalWorldWrapper, Viewport } from "../../components/canvas1/types";
import { GameState } from "~/hooks/useState";
import { MapConfig } from "~/server/map";

export const getScaledTileSize = (config: MapConfig, scaleDecimal: number) => {
    const tileSize = Math.round(config.chunkWidth * scaleDecimal);
    const actualScale = tileSize / config.chunkWidth;

    return { tileSize, actualScale };
};

const COMPARE_GRANULARITY = 1000;
export function hasScaleChanged(state: LocalWorldWrapper) {
    return (
        0 !==
        Math.round(
            (state.world.config.scale - state.world.config.lastScale) *
                COMPARE_GRANULARITY,
        ) /
            COMPARE_GRANULARITY
    );
}

export function generateOldDimensions(state: LocalWorldWrapper): [
    Viewport,
    MapConfig,
] {
    const tileSize = state.world.config.tileSize * state.world.config.lastScale;
    const config: MapConfig = {
        ...state.world.config,
        tileSize,
        scale: state.world.config.lastScale,
        lastScale: state.world.config.lastScale,
    };
    const viewport: Viewport = {
        width: state.client.viewport.width,
        height: state.client.viewport.height,
        origin: state.client.viewport.origin,
    };
    return [
        viewport,
        config,
    ];
}

export function clearOldCanvas(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    // clear old rect
    if (hasScaleChanged(state)) {
        const [ viewport ] = generateOldDimensions(
            state,
        );
        ctx.clearRect(0, 0, viewport.width, viewport.height);
    }
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

    const RR = R.toString(16).padStart(2, "0");
    const GG = G.toString(16).padStart(2, "0");
    const BB = B.toString(16).padStart(2, "0");

    return "#" + RR + GG + BB;
}

export function clearAll(state: GameState) {
    const [ viewport ] = generateOldDimensions(state.ctx);
    [
        [viewport.width, viewport.height], // old
        [
            state.ctx.client.viewport.width, // current
            state.ctx.client.viewport.height,
        ],
    ].forEach(([x, y]) => {
        state.refs.map.value!.getContext("2d")!.clearRect(0, 0, x, y);
        state.refs.objects.value!.getContext("2d")!.clearRect(0, 0, x, y);
        state.refs.players.value!.getContext("2d")!.clearRect(0, 0, x, y);
        state.refs.overlay.value!.getContext("2d")!.clearRect(0, 0, x, y);
    });
}

