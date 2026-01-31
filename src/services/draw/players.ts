import {
    LocalWorldWrapper,
} from "../../components/canvas1/types";
import { MapDimensions, Player } from "~/types/worldTypes";
import { closeOldCanvas } from "./utils";

export function drawPlayers(
    state: LocalWorldWrapper,
    canvas: HTMLCanvasElement,
) {
    const ctx = canvas.getContext("2d")!;
    closeOldCanvas(state, ctx);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw others
    if (state.client.player) drawPlayer(state, ctx, state.client.player);
    if (!state.world.players.size) return;
    state.world.players.forEach((player) => drawPlayer(state, ctx, player));
}

export function drawPlayer(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
    player: Player,
) {
    ctx.fillStyle = player.color;
    const tileSize = state.world.dimensions.tileSize;
    const x = player.pos.x * tileSize;
    const y = player.pos.y * tileSize;
    ctx.fillRect(x, y, tileSize, tileSize);

    drawPlayerName(state.world.dimensions, x, y, ctx, player);
    drawPlayerDirection(state.world.dimensions, ctx, player);
}

function drawPlayerName(
    dimensions: MapDimensions,
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D,
    player: Player,
) {
    const FONT_SIZE = 12 * dimensions.scale;
    ctx.font = `bold ${FONT_SIZE}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "white";
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;
    const CHARS_PER_LINE = 4;
    let charsPerLine = CHARS_PER_LINE;
    let name = player.name.slice(0, 20).trim();
    if (name.length === 4) {
        charsPerLine = CHARS_PER_LINE;
    } else if (name.length / 3 <= 3) {
        charsPerLine = 3;
    }

    const rows = name.length / charsPerLine;
    const center = y + dimensions.tileSize / 2 + 3 * dimensions.scale;
    const start = center - (rows / 2) * FONT_SIZE;
    for (let row = 0; row < rows; row++) {
        const substr = name.slice(0, charsPerLine);
        const y = start + row * FONT_SIZE;
        ctx.strokeText(substr, x + dimensions.tileSize / 2, y);
        ctx.fillText(substr, x + dimensions.tileSize / 2, y);
        name = name.slice(charsPerLine);
    }
}

/**
 * @returns map of offsets for each move
 * */
function generatePlayerDirectionPath(dimensions: MapDimensions): {
    [key: string]: [[number, number], [number, number], [number, number]];
} {
    const oneFourth = (dimensions.tileSize * 1) / 4;
    const oneHalf = dimensions.tileSize / 2;
    const threeFourths = (dimensions.tileSize * 3) / 4;
    const one = dimensions.tileSize;
    return {
        E: [
            [threeFourths, oneFourth],
            [one, oneHalf],
            [threeFourths, threeFourths],
        ],
        W: [
            [oneFourth, oneFourth],
            [0, oneHalf],
            [oneFourth, threeFourths],
        ],
        N: [
            [oneFourth, oneFourth],
            [oneHalf, 0],
            [threeFourths, oneFourth],
        ],
        S: [
            [oneFourth, threeFourths],
            [oneHalf, one],
            [threeFourths, threeFourths],
        ],
    };
}

function drawPlayerDirection(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
    player: Player,
) {
    const x = player.pos.x * dimensions.tileSize;
    const y = player.pos.y * dimensions.tileSize;
    const instructions = generatePlayerDirectionPath(dimensions);
    const instruction = instructions[player.dir];

    // drawing a direction arrow:
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3 * dimensions.scale;

    ctx.moveTo(x + instruction[0][0], y + instruction[0][1]);
    ctx.lineTo(x + instruction[1][0], y + instruction[1][1]);
    ctx.lineTo(x + instruction[2][0], y + instruction[2][1]);

    ctx.stroke();
}


