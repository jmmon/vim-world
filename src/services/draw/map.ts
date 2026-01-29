import { LocalWorldWrapper } from "~/components/canvas1/types";
import { TILE_COLOR_MAP } from "../../components/canvas1/constants";
import { closeOldCanvas } from "./utils";

// Draw map tiles once
export function drawOffscreenMap(state: LocalWorldWrapper) {
    const dimensions = state.world.dimensions;
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.canvasWidth;
    canvas.height = dimensions.canvasHeight;
    const ctx = canvas.getContext("2d")!;

    for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            ctx.fillStyle = TILE_COLOR_MAP[state.world.map[y][x]];
            ctx.fillRect(
                x * dimensions.tileSize,
                y * dimensions.tileSize,
                dimensions.tileSize,
                dimensions.tileSize,
            );
        }
    }
    return canvas;
}

export function drawVisibleMap(
    state: LocalWorldWrapper,
    mapCanvas: HTMLCanvasElement,
    offscreenCanvas: HTMLCanvasElement,
) {
    const ctx = mapCanvas.getContext("2d")!;
    closeOldCanvas(state, ctx);
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    // draw map (blit from offscreen)
    ctx.drawImage(offscreenCanvas, 0, 0);
}

