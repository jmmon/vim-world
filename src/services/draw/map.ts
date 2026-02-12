import { LocalWorldWrapper } from "~/components/canvas1/types";
import { TILE_COLOR_MAP } from "../../components/canvas1/constants";
import { closeOldCanvas, shadeColor } from "./utils";
import { GameState } from "~/hooks/useState";
import { roundToDecimals } from "~/utils/utils";
import { Chunk, getSurroundingTiles } from "~/server/map";
import { MapDimensions } from "~/types/worldTypes";
import chunkService from "../chunk";

const LIGHTNESS_OFFSET = {
    range: 6,
    decimals: 0,
}

// Draw map tiles once
export function drawOffscreenMap(state: LocalWorldWrapper) {
    const dimensions = state.world.dimensions;
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.canvasWidth;
    canvas.height = dimensions.canvasHeight;
    canvas.style.imageRendering = "pixelated";
    const ctx = canvas.getContext("2d")!;
    const chunk = chunkService.getChunk(state.client.player?.pos.x ?? 0, state.client.player?.pos.y ?? 0, state.world.zone);

    for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            const baseColor = TILE_COLOR_MAP[chunk.tiles[y][x].type];
            const lightnessOffset = roundToDecimals((Math.random() * LIGHTNESS_OFFSET.range) - LIGHTNESS_OFFSET.range / 2, LIGHTNESS_OFFSET.decimals);
            const adjusted = shadeColor(baseColor, lightnessOffset);
            ctx.fillStyle = adjusted;
            ctx.fillRect(
                x * dimensions.tileSize,
                y * dimensions.tileSize,
                dimensions.tileSize,
                dimensions.tileSize,
            );

            if (chunk.tiles[y][x].type === 'CLIFF') {
                drawCliffTile(state, dimensions, ctx, x, y, adjusted, chunk);
            }
        }
    }
    return canvas;
}

function drawCliffTile(state: LocalWorldWrapper, dimensions: MapDimensions, ctx: CanvasRenderingContext2D, x: number, y: number, adjustedColor: string, chunk: Chunk) {
    const nearbyTiles = getSurroundingTiles(chunk.tiles, x, y)
    const nearbyCliffDirections = Object.entries(nearbyTiles).reduce<Record<string, "CLIFF" | "OTHER">>((accum, cur) => {
        if (cur[1]?.type === 'CLIFF') accum[cur[0]] = 'CLIFF';
        else if (cur[1] !== undefined) accum[cur[0]] = 'OTHER';
        return accum;
    }, {})

    const darker = shadeColor(adjustedColor, -25);

    /// ok, basically like what I have except:
    // if cliff to South, then hide this tile's bottom dark box
    // if cliff (or undefined) to East, hide this tile's right dark edge
    // if cliff (or undefined) to West, hide this tile's left dark edge
    // if cliff to North, hide this tile's top dark edge

    if (nearbyCliffDirections.S !== 'CLIFF') {
        // show bottom dark box
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(
            x * dimensions.tileSize,
            (y + 1) * dimensions.tileSize - height,
            dimensions.tileSize,
            height,
        );
    }
    if (nearbyCliffDirections.E === 'OTHER') {
        // show tile's right dark edge
        //
        const width = 2 + (Math.random() * 3);
        const width2 = 2 + (Math.random() * 3);
        ctx.fillStyle = darker;

        ctx.beginPath();
        ctx.moveTo(
            (x + 1) * dimensions.tileSize,
            y * dimensions.tileSize
        );
        ctx.lineTo(
            (x + 1) * dimensions.tileSize - 1,
            y * dimensions.tileSize,
        )
        ctx.lineTo(
            (x + 1) * dimensions.tileSize - width,
            (y + 0.5) * dimensions.tileSize - width,
        )
        ctx.lineTo(
            (x + 1) * dimensions.tileSize - 1,
            (y + 0.5) * dimensions.tileSize,
        );
        ctx.lineTo(
            (x + 1) * dimensions.tileSize - width2,
            (y + 1) * dimensions.tileSize - width2,
        )
        ctx.lineTo(
            (x + 1) * dimensions.tileSize,
            (y + 1) * dimensions.tileSize,
        );
        ctx.closePath();
        ctx.fill();

        // ctx.fillRect(
        //     (x + 1) * dimensions.tileSize - width,
        //     y * dimensions.tileSize,
        //     width,
        //     dimensions.tileSize / 2,
        // );
        // ctx.fillRect(
        //     (x + 1) * dimensions.tileSize - (width + 1),
        //     y * dimensions.tileSize + dimensions.tileSize / 2,
        //     width + 1,
        //     dimensions.tileSize / 2,
        // );

    } else if (nearbyCliffDirections.E === 'CLIFF' && nearbyCliffDirections.SE !== 'CLIFF') {
        // drawbottom portion of right border
        const width = 3;
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(
            (x + 1) * dimensions.tileSize - width,
            (y + 1) * dimensions.tileSize - height,
            width,
            height,
        );
    }
    if (nearbyCliffDirections.W === 'OTHER') {
        // show tile's left dark edge
        const width = 3;
        ctx.fillStyle = darker;
        ctx.fillRect(
            x * dimensions.tileSize,
            y * dimensions.tileSize,
            width,
            dimensions.tileSize,
        );
    } else if (nearbyCliffDirections.W === 'CLIFF' && nearbyCliffDirections.SW !== 'CLIFF') {
        // drawbottom portion of right border
        const width = 3;
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(
            x * dimensions.tileSize,
            (y + 1) * dimensions.tileSize - height,
            width,
            height,
        );
    }
    if (nearbyCliffDirections.N !== 'CLIFF') {
        // show tile's top dark edge
        ctx.fillStyle = darker;
        const height = 1;
        ctx.fillRect(
            x * dimensions.tileSize,
            y * dimensions.tileSize,
            dimensions.tileSize,
            height,
        );
    }
}

export function drawVisibleMap(
    state: GameState,
) {
    const ctx = state.refs.map.value!.getContext("2d")!;
    state.refs.map.value!.style.imageRendering = "pixelated";
    closeOldCanvas(state.ctx, ctx);
    ctx.clearRect(0, 0, state.refs.map.value!.width, state.refs.map.value!.height);
    // draw map (blit from offscreen)
    ctx.drawImage(state.refs.offscreenMap.value!, 0, 0);
}


