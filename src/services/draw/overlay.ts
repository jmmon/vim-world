import { roundToDecimals } from "~/utils/utils";
import { generateOldDimensions, hasScaleChanged } from "./utils";
import { MapDimensions } from "~/types/worldTypes";
import { GameState } from "~/hooks/useState";

function getFpsStyles(
    dimensions: MapDimensions,
    canvas: HTMLCanvasElement,
    fps: string,
    ema?: string,
) {
    const lines = ema !== undefined ? 2 : 1;
    const fontSize = 16 * dimensions.scale;
    const width = (5 + fps.length * 0.6) * fontSize; // 16 * 4 = 64
    return {
        ctx: canvas.getContext("2d")!,
        x: dimensions.canvasWidth - width,
        y: 0,
        width,
        height: lines * fontSize + 12 * dimensions.scale,
        leftPadding: 10 * dimensions.scale,
        fontSize,
        lines,
        textLineYOffset: fontSize + 2 * dimensions.scale,
    };
}

function closeFps(
    state: GameState,
    dimensions: MapDimensions,
    fps: string,
    ema?: string,
) {
    const canvas = state.refs.overlay.value!;
    const d = getFpsStyles(dimensions, canvas, fps, ema);
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawFps(state: GameState, fps: string, ema?: string) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeFps(state, generateOldDimensions(state.ctx.world), fps, ema);
    }
    // clear new rect
    const d = closeFps(state, state.ctx.world.dimensions, fps, ema);

    // background
    d.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    d.ctx.fillRect(d.x, d.y, d.width, d.height);

    // fps
    d.ctx.font = `bold ${d.fontSize}px mono`;
    d.ctx.textAlign = "left";
    d.ctx.fillStyle = "red";
    d.ctx.fillText(
        ` fps: ${fps}`,
        d.x + d.leftPadding,
        d.y + d.textLineYOffset,
    );

    // ema
    if (ema !== undefined) {
        d.ctx.fillText(
            `ema5: ${ema}`,
            d.x + d.leftPadding,
            d.y + d.lines * d.textLineYOffset,
        );
    }
}

function getDevStatsStyles(
    dimensions: MapDimensions,
    canvas: HTMLCanvasElement,
) {
    const lines = 4;
    const fontSize = 16 * dimensions.scale;
    const width = 5 * fontSize + 3 * fontSize * 0.6;
    return {
        x: dimensions.canvasWidth - width,
        y: 2 * fontSize + 12 * dimensions.scale + 10, // slight gap from the fps window
        width,
        height: lines * fontSize + 12 * dimensions.scale,
        leftPadding: 10 * dimensions.scale,
        fontSize,
        lines,
        textYOffset: fontSize + 2 * dimensions.scale,
        ctx: canvas.getContext("2d")!,
    };
}

export function closeDevStats(state: GameState) {
    const canvas = state.refs.overlay.value!;
    const d = getDevStatsStyles(generateOldDimensions(state.ctx.world), canvas);
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawDevStats(state: GameState) {
    // idea: draw player pos, afk timer, anything else?
    //
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeDevStats(state);
    }
    // clear new rect
    const d = closeDevStats(state);

    // draw background
    d.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    d.ctx.fillRect(d.x, d.y, d.width, d.height);

    const afkTime =
        state.ctx.client.afkStartTime === -1
            ? "?"
            : roundToDecimals(
                  (Date.now() - state.ctx.client.afkStartTime) / 1000,
                  1,
              ).toFixed(1);
    const idleTime =
        state.ctx.client.idleStartTime === -1
            ? "?"
            : roundToDecimals(
                  (Date.now() - state.ctx.client.idleStartTime) / 1000,
                  1,
              ).toFixed(1);

    // draw stats
    d.ctx.font = `bold ${d.fontSize}px mono`;
    d.ctx.textAlign = "left";
    d.ctx.fillStyle = "red";
    d.ctx.fillText(
        `   x: ${state.ctx.client.player?.pos.x ?? "?"}`,
        d.x + d.leftPadding,
        d.y + d.textYOffset,
    );
    d.ctx.fillText(
        `   y: ${state.ctx.client.player?.pos.y ?? "?"}`,
        d.x + d.leftPadding,
        d.y + 2 * d.textYOffset,
    );
    d.ctx.fillText(
        `idle: ${idleTime}`,
        d.x + d.leftPadding,
        d.y + 3 * d.textYOffset,
    );
    d.ctx.fillText(
        ` afk: ${afkTime}`,
        d.x + d.leftPadding,
        d.y + 4 * d.textYOffset,
    );
}

type RectDimensions = { left: number; top: number; w: number; h: number };
function closeOldHelp(state: GameState, ctx: CanvasRenderingContext2D) {
    if (hasScaleChanged(state.ctx)) {
        const HELP = generateHelpDimensions(
            generateOldDimensions(state.ctx.world),
        );
        ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    }
}
function generateHelpDimensions(dimensions: MapDimensions): RectDimensions {
    const heightTiles = 8;
    const bottomPaddingTiles = 0.5;
    const xPaddingTiles = 0.5;
    return {
        left: dimensions.tileSize * xPaddingTiles,
        top:
            dimensions.tileSize *
            (dimensions.height - heightTiles - bottomPaddingTiles), // 6 tiles up from bottom
        w:
            dimensions.width * dimensions.tileSize -
            dimensions.tileSize * (2 * xPaddingTiles),
        h: dimensions.tileSize * heightTiles,
    };
}

// let HELP_DIMENSIONS: RectDimensions | undefined;
// const getHelpDimensions = (dimensions: MapDimensions) => {
//     if (!HELP_DIMENSIONS) {
//         HELP_DIMENSIONS = generateHelpDimensions(dimensions);
//     }
//     return HELP_DIMENSIONS;
// };
const HELP_TEXT = [
    "h - Move left",
    "l - Move right",
    "k - Move up",
    "j - Move down",
    "w - Jump right",
    "b - Jump left",
    ":h<enter> :help<enter> g? - Open Help",
    // ":h<enter> - Toggle Help",
    // ":help<enter> - Toggle Help",
    // "g? - Toggle Help",
];
const ROWS = 6;

export function drawHelp(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldHelp(state, ctx);

    const HELP = generateHelpDimensions(state.ctx.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(HELP.left, HELP.top, HELP.w, HELP.h);

    ctx.font = `bold ${18 * state.ctx.world.dimensions.scale}px mono`;
    ctx.fillStyle = "white";
    const helpTextPadding = {
        x: 1,
        y: 1,
    };
    for (let i = 0; i < HELP_TEXT.length; i++) {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        ctx.fillText(
            HELP_TEXT[i],
            HELP.left +
                state.ctx.world.dimensions.tileSize * helpTextPadding.x +
                col * (224 * state.ctx.world.dimensions.scale),
            HELP.top +
                state.ctx.world.dimensions.tileSize *
                    (helpTextPadding.y + row) +
                20 * state.ctx.world.dimensions.scale,
        );
    }
}

export function closeHelp(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldHelp(state, ctx);

    const HELP = generateHelpDimensions(state.ctx.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
}

const TEXT_HELP_HINT = [
    { text: "Hint: type", color: "white" },
    { text: " :h<enter>", color: "#ffcc88" },
    { text: "to open Help", color: "white" },
];
export function drawHelpHint(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    if (hasScaleChanged(state.ctx)) {
        const { tileSize } = generateOldDimensions(state.ctx.world);
        ctx.clearRect(
            tileSize * 0.5,
            tileSize * 0.5,
            tileSize * 4,
            tileSize * 2.5,
        );
    }
    ctx.clearRect(
        state.ctx.world.dimensions.tileSize * 0.5,
        state.ctx.world.dimensions.tileSize * 0.5,
        state.ctx.world.dimensions.tileSize * 4,
        state.ctx.world.dimensions.tileSize * 2.5,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
        state.ctx.world.dimensions.tileSize * 0.5,
        state.ctx.world.dimensions.tileSize * 0.5,
        state.ctx.world.dimensions.tileSize * 4,
        state.ctx.world.dimensions.tileSize * 2.5,
    );
    ctx.font = `bold ${16 * state.ctx.world.dimensions.scale}px mono`;
    for (let i = 0; i < TEXT_HELP_HINT.length; i++) {
        ctx.fillStyle = TEXT_HELP_HINT[i].color;
        ctx.fillText(
            TEXT_HELP_HINT[i].text,
            state.ctx.world.dimensions.tileSize * 0.5 +
                state.ctx.world.dimensions.tileSize / 4,
            state.ctx.world.dimensions.tileSize * 1 +
                state.ctx.world.dimensions.tileSize / 8 +
                ((state.ctx.world.dimensions.tileSize * 3) / 4) * i,
        );
    }
}

function closeOldAfk(state: GameState) {
    if (hasScaleChanged(state.ctx)) {
        const dimensions = generateOldDimensions(state.ctx.world);
        state.refs.overlay
            .value!.getContext("2d")!
            .clearRect(
                dimensions.tileSize * 6.5,
                dimensions.tileSize / 2,
                dimensions.canvasWidth - dimensions.tileSize * 13,
                dimensions.tileSize * 5,
            );
    }
}
export function closeAfk(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldAfk(state);
    ctx.clearRect(
        state.ctx.world.dimensions.tileSize * 6.5,
        state.ctx.world.dimensions.tileSize / 2,
        state.ctx.world.dimensions.canvasWidth -
            state.ctx.world.dimensions.tileSize * 13,
        state.ctx.world.dimensions.tileSize * 5,
    );
}

export function drawAfk(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;

    closeOldAfk(state);
    const panelWidth =
        state.ctx.world.dimensions.canvasWidth -
        state.ctx.world.dimensions.tileSize * 13;
    ctx.clearRect(
        state.ctx.world.dimensions.tileSize * 6.5,
        state.ctx.world.dimensions.tileSize / 2,
        panelWidth,
        state.ctx.world.dimensions.tileSize * 4,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
        state.ctx.world.dimensions.tileSize * 6.5,
        state.ctx.world.dimensions.tileSize / 2,
        panelWidth,
        state.ctx.world.dimensions.tileSize * 4,
    );
    ctx.font = `bold ${24 * state.ctx.world.dimensions.scale}px mono`;
    ctx.textAlign = "center";
    ctx.fillStyle = "red";
    ctx.fillText(
        `You are AFK!`,
        state.ctx.world.dimensions.tileSize * 6.5 + panelWidth / 2,
        state.ctx.world.dimensions.tileSize * 2.5,
    );
}

// maybe draw a statusbar: modes, not sure what else, maybe coords of player (like the rows:cols), maybe a clock for fun
//
// and then another lower bar for command entries??
//
function getStatusStyles(dimensions: MapDimensions, canvas: HTMLCanvasElement) {
    const lines = 2;
    const fontSize = 16 * dimensions.scale;
    // const width = 5 * fontSize + fps.length * fontSize * 0.6; // 16 * 4 = 64
    const rowGap = 0 * dimensions.scale;
    const y =
        dimensions.canvasHeight - (fontSize * lines + (lines - 1) * rowGap);
    return {
        x: 0,
        y,
        width: dimensions.canvasWidth,
        height: dimensions.canvasHeight - y,
        leftPadding: 10 * dimensions.scale,
        fontSize,
        lines,
        rowGap,
        ctx: canvas.getContext("2d")!,
    };
}

function closeStatus(state: GameState, dimensions: MapDimensions) {
    const canvas = state.refs.overlay.value!;
    const d = getStatusStyles(dimensions, canvas);
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawStatus(state: GameState) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeStatus(state, generateOldDimensions(state.ctx.world));
    }
    // clear new rect
    const d = closeStatus(state, state.ctx.world.dimensions);

    // background
    d.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    d.ctx.fillRect(d.x, d.y, d.width, d.height);

    // top line:
    // mode:
    const text = `Mode: Normal`;
    const width = (0.8 + text.length * 0.6) * d.fontSize; // 16 * 4 = 64
    d.ctx.fillStyle = "skyblue";
    d.ctx.fillRect(
        d.x + d.leftPadding - 0.4 * d.fontSize,
        d.y,
        width,
        d.fontSize,
    );
    d.ctx.font = `normal ${d.fontSize}px mono`;
    d.ctx.textAlign = "left";
    d.ctx.fillStyle = "black";
    d.ctx.fillText(text, d.x + d.leftPadding, d.y + d.fontSize - 2);

    // right side: position
    d.ctx.textAlign = "right";
    d.ctx.fillStyle = "white";
    d.ctx.fillText(
        `${state.ctx.client.player?.pos.y ?? 0}:${state.ctx.client.player?.pos.x ?? 0}`,
        d.width - d.x - d.leftPadding,
        d.y + d.fontSize - 2,
    );

    // lower line: command buffer
    if (state.ctx.client.commandBuffer.length === 0) return;
    d.ctx.textAlign = "left";
    d.ctx.fillStyle = "white";
    d.ctx.fillText(
        state.ctx.client.commandBuffer,
        d.x + d.leftPadding,
        d.y + d.fontSize * 2 - 2,
    );
}
