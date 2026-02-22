import { Direction, MapDimensions, Player } from "~/types/worldTypes";
import { closeOldCanvas } from "./utils";
import { GameState } from "~/hooks/useState";
import chunkService from "../chunk";

export function drawPlayers(state: GameState) {
    const canvas = state.refs.players.value!;
    const ctx = canvas.getContext("2d")!;
    closeOldCanvas(state.ctx, ctx);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw others
    if (state.ctx.client.player)
        drawPlayer(state, state.ctx.client.player);
    if (!state.ctx.world.players.size) return;
    state.ctx.world.players.forEach((player) =>
        drawPlayer(state, player),
    );
}

export function drawPlayer(
    state: GameState,
    player: Player,
) {
    const ctx = state.refs.players.value!.getContext("2d")!;

    ctx.fillStyle = player.color;
    const tileSize = state.ctx.world.dimensions.tileSize;
    const { localX, localY } = chunkService.getLocalChunkCoords(player.pos);
    const x = localX * tileSize;
    const y = localY * tileSize;
    ctx.fillRect(x, y, tileSize, tileSize);

    drawPlayerName(state.ctx.world.dimensions, x, y, player.name, ctx);
    drawPlayerDirection(state.ctx.world.dimensions, x, y, player.dir, ctx);
}

function drawPlayerName(
    dimensions: MapDimensions,
    x: number,
    y: number,
    name: string,
    ctx: CanvasRenderingContext2D,
) {
    const DISPLAY_NAME = name.slice(0, 16).trim(); // max 4x4 to display
    const CHARS_PER_LINE = (DISPLAY_NAME.length > 4 && DISPLAY_NAME.length <= 9) 
        ? 3  // try for 3x3
        : 4; // else 4 chars per line

    // 3 will use 12
    // 4 will use 12 * 4/5 = 9.6
    const FONT_SIZE = (12 * (3 + 1) / (CHARS_PER_LINE + 1)) * dimensions.scale;
    ctx.font = `bold ${FONT_SIZE}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    ctx.fillStyle = "black";

    const rows = DISPLAY_NAME.length / CHARS_PER_LINE;
    const center = y + dimensions.tileSize / 2 + 3 * dimensions.scale; // add a little padding to get centered
    const start = center - (rows / 2) * FONT_SIZE;

    for (let row = 0; row < rows; row++) {
        const substr = DISPLAY_NAME.slice(row * CHARS_PER_LINE, (row+1) * CHARS_PER_LINE);
        const y = start + row * FONT_SIZE;
        ctx.strokeText(substr, x + dimensions.tileSize / 2, y); // outline
        ctx.fillText(substr, x + dimensions.tileSize / 2, y); // fill
    }
}

/**
 * @returns map of offsets for each move
 * */
type PlayerDirectionPath = Record<string, [[number, number], [number, number], [number, number]]>;
const tileSizeToplayerDirectionPathMap: Record<number, PlayerDirectionPath> = {};

function genDirPath(dimensions: MapDimensions): PlayerDirectionPath {
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


function getPlayerDirectionPath(dimensions: MapDimensions) {
    if (!tileSizeToplayerDirectionPathMap[dimensions.tileSize]) {
        tileSizeToplayerDirectionPathMap[dimensions.tileSize] = genDirPath(dimensions);
    }

    return tileSizeToplayerDirectionPathMap[dimensions.tileSize];
}

function drawPlayerDirection(
    dimensions: MapDimensions,
    x: number,
    y: number,
    dir: Direction,
    ctx: CanvasRenderingContext2D,
) {
    const instructions = getPlayerDirectionPath(dimensions);
    const instruction = instructions[dir];

    // drawing a direction arrow:
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3 * dimensions.scale;

    ctx.moveTo(x + instruction[0][0], y + instruction[0][1]);
    ctx.lineTo(x + instruction[1][0], y + instruction[1][1]);
    ctx.lineTo(x + instruction[2][0], y + instruction[2][1]);

    ctx.stroke();
}


