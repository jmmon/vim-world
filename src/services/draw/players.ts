import { Direction, Player } from "~/types/worldTypes";
import { clearOldCanvas } from "./utils";
import { GameState } from "~/hooks/useState";
import { getViewportCoordsAsPx } from "~/simulation/shared/helpers";

export function drawPlayers(state: GameState) {
    const selfPlayer = state.ctx.client.player;
    const otherPlayers = state.ctx.world.players;
    if (!selfPlayer && !otherPlayers.size) return;

    const canvas = state.refs.players.value!;
    const ctx = canvas.getContext("2d")!;

    clearOldCanvas(state.ctx, ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const _drawPlayer = createPlayerDrawerForState(state, ctx);

    // draw self
    if (selfPlayer) _drawPlayer(selfPlayer);

    // draw others
    if (otherPlayers.size) otherPlayers.forEach(_drawPlayer);
}

function createPlayerDrawerForState(
    state: GameState,
    ctx: CanvasRenderingContext2D,
) {
    return (player: Player) => drawPlayer(state, player, ctx);
}

function drawPlayer(
    state: GameState,
    player: Player,
    ctx: CanvasRenderingContext2D,
) {
    ctx.fillStyle = player.color;
    const { tileSize } = state.ctx.world.config;
    const { viewport } = state.ctx.client;

    const playerPx = { x: player.pos.x * tileSize, y: player.pos.y * tileSize };
    const { px, py } = getViewportCoordsAsPx(playerPx, viewport.origin);
    const x = px;
    const y = py;

    ctx.fillRect(x, y, tileSize, tileSize);

    drawPlayerName(state, x, y, player.name, ctx);
    drawPlayerDirection(state, x, y, player.dir, ctx);
}

function drawPlayerName(
    state: GameState,
    x: number,
    y: number,
    name: string,
    ctx: CanvasRenderingContext2D,
) {
    const { scale, tileSize } = state.ctx.world.config;
    const DISPLAY_NAME = name.slice(0, 16).trim(); // max 4x4 to display
    const CHARS_PER_LINE =
        DISPLAY_NAME.length > 4 && DISPLAY_NAME.length <= 9
            ? 3 // try for 3x3
            : 4; // else 4 chars per line

    // 3 will use 12
    // 4 will use 12 * 4/5 = 9.6
    // const FONT_SIZE = 12 * (3 + 1) / (CHARS_PER_LINE + 1) * scale;
    const FONT_SIZE = 10 * scale;
    ctx.font = `bold ${FONT_SIZE}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    ctx.fillStyle = "black";

    const rows = DISPLAY_NAME.length / CHARS_PER_LINE;
    const center = y + tileSize / 2 + (5 * scale); // add a little padding to get centered
    const start = center - (rows / 2) * FONT_SIZE;

    for (let row = 0; row < rows; row++) {
        const substr = DISPLAY_NAME.slice(
            row * CHARS_PER_LINE,
            (row + 1) * CHARS_PER_LINE,
        );
        const y = start + row * FONT_SIZE;
        ctx.strokeText(substr, x + tileSize / 2, y); // outline
        ctx.fillText(substr, x + tileSize / 2, y); // fill
    }
}

/**
 * @returns map of offsets for each move
 * */
type PlayerDirectionPath = Record<
    string,
    [[number, number], [number, number], [number, number]]
>;
const tileSizeToPlayerDirectionPathMap: Record<number, PlayerDirectionPath> =
    {};

const ONE_FOURTH = 1 / 4;
const ONE_HALF = 1 / 2;
const THREE_FOURTHS = 3 / 4;
function genDirPath(): PlayerDirectionPath {
    return {
        E: [
            [THREE_FOURTHS, ONE_FOURTH],
            [1, ONE_HALF],
            [THREE_FOURTHS, THREE_FOURTHS],
        ],
        W: [
            [ONE_FOURTH, ONE_FOURTH],
            [0, ONE_HALF],
            [ONE_FOURTH, THREE_FOURTHS],
        ],
        N: [
            [ONE_FOURTH, ONE_FOURTH],
            [ONE_HALF, 0],
            [THREE_FOURTHS, ONE_FOURTH],
        ],
        S: [
            [ONE_FOURTH, THREE_FOURTHS],
            [ONE_HALF, 1],
            [THREE_FOURTHS, THREE_FOURTHS],
        ],
    };
}

function getPlayerDirectionPath(tileSize: number) {
    tileSizeToPlayerDirectionPathMap[tileSize] ??= genDirPath();

    return tileSizeToPlayerDirectionPathMap[tileSize];
}

function drawPlayerDirection(
    state: GameState,
    x: number,
    y: number,
    dir: Direction,
    ctx: CanvasRenderingContext2D,
) {
    const { tileSize, scale } = state.ctx.world.config;
    const instruction = getPlayerDirectionPath(tileSize)[dir];

    // drawing a direction arrow:
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3 * scale;

    ctx.moveTo(
        x + instruction[0][0] * tileSize,
        y + instruction[0][1] * tileSize,
    );
    ctx.lineTo(
        x + instruction[1][0] * tileSize,
        y + instruction[1][1] * tileSize,
    );
    ctx.lineTo(
        x + instruction[2][0] * tileSize,
        y + instruction[2][1] * tileSize,
    );

    ctx.stroke();
}

