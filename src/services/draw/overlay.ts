import { roundToDecimals } from "~/utils/utils";
import { generateOldDimensions, hasScaleChanged } from "./utils";
import { MapDimensions } from "~/types/worldTypes";
import { GameState } from "~/hooks/useState";

// probably should not be using viewportWidthPx, instead use viewportWidthBlocks * tileSize * scale

function getBoxStyles(
    lines: number,
    fontSize: number,
    leftPaddingPx: number,
    lineHeightPaddingPx: number,
    widthPx: number,
    verticalPaddingPx: number,
    scale: number,
) {
    const scaled_fontSize = fontSize * scale;
    const scaled_lineHeight = (fontSize + lineHeightPaddingPx) * scale;
    const scaled_width = widthPx * scaled_fontSize; // 16 * 4 = 64
    const scaled_verticalPadding = verticalPaddingPx * scale;

    return {
        width: scaled_width,
        height: lines * scaled_lineHeight + scaled_verticalPadding,
        leftPadding: leftPaddingPx * scale,
        fontSize: scaled_fontSize,
        lineHeight: scaled_lineHeight,
    };
}

// ****************************************************************
//
//                      FPS styles
//
// ****************************************************************

// has about 10 total chars wide + padding
function getFpsStyles(
    dimensions: MapDimensions,
    canvas: HTMLCanvasElement,
    fps: string, // length of 2-4
    ema?: string,
) {
    const LINES = 1 + Number(ema !== undefined);
    const FONT_SIZE = 16;
    const styles = getBoxStyles(
        LINES,
        FONT_SIZE,
        10,
        2,
        (6 + fps.length) * 0.9,
        12,
        dimensions.scale,
    );
    return {
        ctx: canvas.getContext("2d")!,
        x: dimensions.viewportWidthPx - styles.width,
        y: 0,
        lines: LINES,
        ...styles,
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
    d.ctx.fillText(` fps: ${fps}`, d.x + d.leftPadding, d.y + d.lineHeight);

    // ema
    if (ema !== undefined) {
        d.ctx.fillText(
            `ema5: ${ema}`,
            d.x + d.leftPadding,
            d.y + d.lines * d.lineHeight,
        );
    }
}

// ****************************************************************
//
//                      DEV STATS styles
//
// ****************************************************************

function getFormattedTime(value: number) {
    return value === -1
        ? "?"
        : roundToDecimals((Date.now() - value) / 1000, 1).toFixed(1);
}

const STAT_MAP = [
    // {
    //     name: "x",
    //     getValue: (state: GameState) => state.ctx.client.player?.pos.x ?? "?",
    // },
    // {
    //     name: "y",
    //     getValue: (state: GameState) => state.ctx.client.player?.pos.y ?? "?",
    // },
    {
        name: "idle",
        getValue: (state: GameState) =>
            getFormattedTime(state.ctx.client.idleStartTime),
    },
    {
        name: "afk",
        getValue: (state: GameState) =>
            getFormattedTime(state.ctx.client.afkStartTime),
    },
    {
        name: "collision",
        getValue: (state: GameState) => (state.ctx.physics.collision ? "YES" : "NO"),
    },
    {
        name: "prediction",
        getValue: (state: GameState) => (state.ctx.physics.prediction ? "YES" : "NO"),
    },
];

const STAT_NAME_LONGEST = STAT_MAP.sort(
    (a, b) => b.name.length - a.name.length,
)[0].name.length;



function statText(
    text: string,
    value: string | number,
    maxWordLength = STAT_NAME_LONGEST,
) {
    const s = String(value);
    return text.padStart(maxWordLength - Math.max(0, s.length - 3)) + `: ` + s;
}

function fillStatLine(d: D, name: string, value: string | number, row: number) {
    d.ctx.fillText(
        statText(name, value),
        d.x + d.leftPadding,
        d.y + row * d.lineHeight,
    );
}

type D = {
    width: number;
    height: number;
    leftPadding: number;
    fontSize: number;
    lineHeight: number;
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
    lines: number;
};
function getDevStatsStyles(
    dimensions: MapDimensions,
    canvas: HTMLCanvasElement,
): D {
    const LINES = STAT_MAP.length;
    const FONT_SIZE = 16;

    const styles = getBoxStyles(
        LINES,
        FONT_SIZE,
        10,
        2,
        (STAT_NAME_LONGEST + 2) * 0.9,
        12,
        dimensions.scale,
    );
    const fpsYEnd = 2 * styles.fontSize + 12 * dimensions.scale;

    return {
        ctx: canvas.getContext("2d")!,
        x: dimensions.viewportWidthPx - styles.width,
        y: fpsYEnd + 10 * dimensions.scale, // slight gap from the fps window
        lines: LINES,
        ...styles,
    };
}

export function closeDevStats(state: GameState, dimensions?: MapDimensions) {
    const canvas = state.refs.overlay.value!;
    const d = getDevStatsStyles(
        dimensions ?? state.ctx.world.dimensions,
        canvas,
    );
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export async function drawDevStats(state: GameState) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeDevStats(state, generateOldDimensions(state.ctx.world));
    }
    // clear new rect
    const d = closeDevStats(state);

    // draw background
    d.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    d.ctx.fillRect(d.x, d.y, d.width, d.height);

    // draw stats
    d.ctx.font = `bold ${d.fontSize}px mono`;
    d.ctx.textAlign = "left";
    d.ctx.fillStyle = "red";

    for (let i = 0; i < STAT_MAP.length; i++) {
        fillStatLine(d, STAT_MAP[i].name, STAT_MAP[i].getValue(state), i + 1);
    }
}

// ****************************************************************
//
//                      FULL HELP styles
//
// ****************************************************************

type RectDimensions = { left: number; top: number; w: number; h: number };
function generateHelpDimensions(dimensions: MapDimensions): RectDimensions {
    const heightTiles = 8;
    const bottomPaddingTiles = 0.5;
    const xPaddingTiles = 0.5;
    return {
        left: dimensions.tileSize * xPaddingTiles,
        top:
            dimensions.tileSize *
            (dimensions.viewportHeightBlocks -
                heightTiles -
                bottomPaddingTiles), // 6 tiles up from bottom
        w:
            dimensions.tileSize *
            (dimensions.viewportWidthBlocks - 2 * xPaddingTiles),
        h: dimensions.tileSize * heightTiles,
    };
}

function closeOldHelp(state: GameState, ctx: CanvasRenderingContext2D) {
    if (hasScaleChanged(state.ctx)) {
        const HELP = generateHelpDimensions(
            generateOldDimensions(state.ctx.world),
        );
        ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    }
}

const HELP_DIMENSIONS: Record<string, RectDimensions> = {};
const getHelpDimensions = (dimensions: MapDimensions) => {
    if (!HELP_DIMENSIONS[dimensions.tileSize]) {
        HELP_DIMENSIONS[dimensions.tileSize] =
            generateHelpDimensions(dimensions);
    }
    return HELP_DIMENSIONS[dimensions.tileSize];
};
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

    const HELP = getHelpDimensions(state.ctx.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(HELP.left, HELP.top, HELP.w, HELP.h);

    ctx.font = `bold ${18 * state.ctx.world.dimensions.scale}px mono`;
    ctx.fillStyle = "white";
    const helpTextPadding = {
        x: 1,
        y: 1,
    };
    const leftPadding =
        HELP.left + state.ctx.world.dimensions.tileSize * helpTextPadding.x;
    const topPadding = HELP.top + 20 * state.ctx.world.dimensions.scale;
    const columnPadding = 224 * state.ctx.world.dimensions.scale;
    for (let i = 0; i < HELP_TEXT.length; i++) {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        ctx.fillText(
            HELP_TEXT[i],
            leftPadding + col * columnPadding,
            topPadding +
                state.ctx.world.dimensions.tileSize * (helpTextPadding.y + row),
        );
    }
}

export function closeHelp(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldHelp(state, ctx);

    const HELP = generateHelpDimensions(state.ctx.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
}

// ****************************************************************
//
//                      HELP HINT styles
//
// ****************************************************************

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

// ****************************************************************
//
//                      AFK styles
//
// ****************************************************************

/** @returns [x, y, width, height] array */
function getAfkRect(dimensions: MapDimensions) {
    return [
        dimensions.tileSize * 6.5,
        dimensions.tileSize / 2,
        dimensions.viewportWidthPx - dimensions.tileSize * 13,
        dimensions.tileSize * 5,
    ] as const;
}

function clearAfkRect(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
) {
    ctx.clearRect(...getAfkRect(dimensions));
}
// generateOldDimensions(state.ctx.world)
export function closeAfk(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    clearAfkRect(state.ctx.world.dimensions, ctx);
    if (!hasScaleChanged(state.ctx)) return;
    clearAfkRect(generateOldDimensions(state.ctx.world), ctx);
}

export function drawAfk(state: GameState) {
    closeAfk(state);

    const ctx = state.refs.overlay.value!.getContext("2d")!;

    const dimensions = getAfkRect(state.ctx.world.dimensions);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(...dimensions);

    ctx.font = `bold ${24 * state.ctx.world.dimensions.scale}px mono`;
    ctx.textAlign = "center";
    ctx.fillStyle = "red";
    ctx.fillText(
        `You are AFK!`,
        dimensions[0] + dimensions[2] / 2,
        dimensions[3] / 2,
    );
}

// ****************************************************************
//
//                      statusbar styles
//
// ****************************************************************

function getStatusStyles(dimensions: MapDimensions, canvas: HTMLCanvasElement) {
    const LINES = 2;
    const FONT_SIZE = 16;
    const styles = getBoxStyles(
        LINES,
        FONT_SIZE,
        10,
        0,
        0,
        0,
        dimensions.scale,
    );
    return {
        ctx: canvas.getContext("2d")!,
        x: 0,
        y: dimensions.viewportHeightPx - styles.height,
        rowGap: 0,
        ...styles,
        width: dimensions.viewportWidthPx,
    };
}

function closeStatus(state: GameState, dimensions?: MapDimensions) {
    const canvas = state.refs.overlay.value!;
    const d = getStatusStyles(dimensions ?? state.ctx.world.dimensions, canvas);
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawStatus(state: GameState) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeStatus(state, generateOldDimensions(state.ctx.world));
    }
    // clear new rect
    const d = closeStatus(state);

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
