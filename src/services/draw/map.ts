import { TILE_COLOR_MAP } from "../../components/canvas1/constants";
import { clearOldCanvas, shadeColor } from "./utils";
import { GameState } from "~/hooks/useState";
import { roundToDecimals } from "~/utils/utils";
import { Chunk, getSurroundingTiles } from "~/server/map";
import chunkService, {
    ChunkKey,
    __visibleChunks,
} from "../chunk";
import { TileType, } from "~/types/worldTypes";

type TileDrawer = (
    tileSize: number,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    adjustedColor: string,
    chunk: Chunk,
) => void;

const drawTile: TileDrawer = function (
    tileSize: number,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    adjustedColor: string,
    _: Chunk,
) {
    ctx.fillStyle = adjustedColor;
    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
}

// draws some edges to make it look more 3d
const drawCliffTile: TileDrawer = function (
    tileSize: number,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    adjustedColor: string,
    chunk: Chunk,
) {
    ctx.fillStyle = adjustedColor;
    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

    const nearbyTiles = getSurroundingTiles(chunk.tiles, x, y);
    const nearbyCliffDirections = Object.entries(nearbyTiles).reduce<
        Record<string, "CLIFF" | "OTHER">
    >((accum, cur) => {
        if (cur[1]?.type === "CLIFF") accum[cur[0]] = "CLIFF";
        else if (cur[1] !== undefined) accum[cur[0]] = "OTHER";
        return accum;
    }, {});

    const darker = shadeColor(adjustedColor, -25);
    const rng = chunkService.getChunkRng(chunk.seed);
        

    /// ok, basically like what I have except:
    // if cliff to South, then hide this tile's bottom dark box
    // if cliff (or undefined) to East, hide this tile's right dark edge
    // if cliff (or undefined) to West, hide this tile's left dark edge
    // if cliff to North, hide this tile's top dark edge

    if (nearbyCliffDirections.S !== "CLIFF") {
        // show bottom dark box
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(
            x * tileSize,
            (y + 1) * tileSize - height,
            tileSize,
            height,
        );
    }
    if (nearbyCliffDirections.E === "OTHER") {
        // show tile's right dark edge
        //
        const width = 2 + rng() * 3;
        const width2 = 2 + rng() * 3;
        ctx.fillStyle = darker;

        ctx.beginPath();
        ctx.moveTo((x + 1) * tileSize, y * tileSize);
        ctx.lineTo((x + 1) * tileSize - 1, y * tileSize);
        ctx.lineTo((x + 1) * tileSize - width, (y + 0.5) * tileSize - width);
        ctx.lineTo((x + 1) * tileSize - 1, (y + 0.5) * tileSize);
        ctx.lineTo((x + 1) * tileSize - width2, (y + 1) * tileSize - width2);
        ctx.lineTo((x + 1) * tileSize, (y + 1) * tileSize);
        ctx.closePath();
        ctx.fill();

        // ctx.fillRect(
        //     (x + 1) * tileSize - width,
        //     y * tileSize,
        //     width,
        //     tileSize / 2,
        // );
        // ctx.fillRect(
        //     (x + 1) * tileSize - (width + 1),
        //     y * tileSize + tileSize / 2,
        //     width + 1,
        //     tileSize / 2,
        // );
    } else if (
        nearbyCliffDirections.E === "CLIFF" &&
        nearbyCliffDirections.SE !== "CLIFF"
    ) {
        // drawbottom portion of right border
        const width = 3;
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(
            (x + 1) * tileSize - width,
            (y + 1) * tileSize - height,
            width,
            height,
        );
    }
    if (nearbyCliffDirections.W === "OTHER") {
        // show tile's left dark edge
        const width = 3;
        ctx.fillStyle = darker;
        ctx.fillRect(x * tileSize, y * tileSize, width, tileSize);
    } else if (
        nearbyCliffDirections.W === "CLIFF" &&
        nearbyCliffDirections.SW !== "CLIFF"
    ) {
        // drawbottom portion of right border
        const width = 3;
        const height = 14;
        ctx.fillStyle = darker;
        ctx.fillRect(x * tileSize, (y + 1) * tileSize - height, width, height);
    }
    if (nearbyCliffDirections.N !== "CLIFF") {
        // show tile's top dark edge
        ctx.fillStyle = darker;
        const height = 1;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, height);
    }
}

const tileMap: Record<TileType, TileDrawer> = {
    CLIFF: drawCliffTile,
    GRASS: drawTile,
    WATER: drawTile,
    DIRT: drawTile,
};

const LIGHTNESS_OFFSET = {
    range: 6,
    decimals: 0,
};

function drawChunk(
    state: GameState,
    chunkKey: ChunkKey,
) {
    const canvas = state.refs.offscreenMap.value!;
    const { tileSize, chunkWidth, chunkHeight } = state.ctx.world.config;
    const ctx = canvas.getContext("2d")!;

    const worldCellOffset = chunkService.getWorldCoordsByChunkKey(chunkKey);
    const chunk = chunkService.getChunkByKey(chunkKey, state.ctx.world.zone);
    const rng = chunkService.getChunkRng(chunk.seed);

    for (let ly = 0; ly < chunkHeight; ly++) {
        for (let lx = 0; lx < chunkWidth; lx++) {
            const baseColor = TILE_COLOR_MAP[chunk.tiles[ly][lx].type];
            const lightnessOffset = roundToDecimals(
                rng() * LIGHTNESS_OFFSET.range - LIGHTNESS_OFFSET.range / 2,
                LIGHTNESS_OFFSET.decimals,
            );
            const adjusted = shadeColor(baseColor, lightnessOffset);

            const x = lx + worldCellOffset.x;
            const y = ly + worldCellOffset.y;

            tileMap[chunk.tiles[ly][lx].type](
                tileSize,
                ctx,
                x,
                y,
                adjusted,
                chunk,
            );
        }
    }
}

export function initOffscreenCanvas(state: GameState, canvas?: HTMLCanvasElement) {
    const canvasRef = canvas ?? document.createElement("canvas");
    const { width, height, tileSize, chunkWidth, chunkHeight } = state.ctx.world.config;
    canvasRef.width = width * tileSize * chunkWidth;
    canvasRef.height = height * tileSize * chunkHeight;

    console.log("set up offscreen canvas dimensions:", {
        width: canvasRef.width,
        height: canvasRef.height,
    });
    return canvasRef;
}

// Draw map tiles once
// TODO: draw all visible chunks
export function drawOffscreenMap(
    state: GameState,
    visibleChunks: ChunkKey[] = __visibleChunks,
) {
    // console.log("drawing offscreen map::", visibleChunks);
    for (const chunkKey of visibleChunks) {
        // console.log("drawing chunk:", chunkKey);
        drawChunk(state, chunkKey);
    }
}


// TODO: draw only viewport
export function drawVisibleMap(state: GameState) {
    const canvas = state.refs.map.value!;
    const ctx = canvas.getContext("2d")!;
    // console.log("drawing visible map:", {
    //     map: canvas,
    //     offscreenMap: state.refs.offscreenMap.value,
    // });
    clearOldCanvas(state.ctx, ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { origin, width, height } = state.ctx.client.viewport;

    const sx = origin.x;
    const sy = origin.y;
    const sw = width;
    const sh = height;
    // console.log({ sx, sy, sw, sh });

    // draw map (blit from offscreen)
    ctx.drawImage(state.refs.offscreenMap.value!, sx, sy, sw, sh, 0, 0, sw, sh);
}
