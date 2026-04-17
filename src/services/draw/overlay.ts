import { roundToDecimals } from "~/utils/utils";
import { generateOldDimensions, hasScaleChanged } from "./utils";
import { GameState } from "~/hooks/useState";
import { MapConfig } from "~/server/map";
import { Viewport } from "~/components/canvas1/types";
import chunkService, { __visibleChunks } from "../chunk";

// probably should not be using viewportWidthPx, instead use viewportWidthBlocks * tileSize * scale

function getBoxStyles(
    lines: number,
    fontSize: number,
    leftPaddingPx: number,
    lineHeightPaddingPx: number,
    widthPx: number,
    verticalPaddingPx: number,
    scale: number,
): BoxStyles {
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
        lines,
    };
}
interface BoxStyles {
    width: number;
    height: number;
    leftPadding: number;
    fontSize: number;
    lineHeight: number;
    lines: number;
};
interface StylesWithContext extends BoxStyles {
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
};

// ****************************************************************
//
//                      FPS styles
//
// ****************************************************************

// has about 10 total chars wide + padding
function getFpsStyles(
    viewport: Viewport,
    { scale }: MapConfig,
    canvas: HTMLCanvasElement,
    fps: string, // length of 2-4
    ema?: string,
): StylesWithContext {
    const LINES = 1 + Number(ema !== undefined);
    const FONT_SIZE = 16;
    const styles = getBoxStyles(
        LINES,
        FONT_SIZE,
        10,
        2,
        (6 + fps.length) * 0.9,
        12,
        scale,
    );
    return {
        ctx: canvas.getContext("2d")!,
        x: viewport.width - styles.width,
        y: 0,
        ...styles,
    };
}

function closeFps(
    state: GameState,
    viewport: Viewport,
    config: MapConfig,
    fps: string,
    ema?: string,
) {
    const canvas = state.refs.overlay.value!;
    const d = getFpsStyles(viewport, config, canvas, fps, ema);
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawFps(state: GameState, fps: string, ema?: string) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeFps(state, ...generateOldDimensions(state.ctx), fps, ema);
    }
    // clear new rect
    const d = closeFps(
        state,
        state.ctx.client.viewport,
        state.ctx.world.config,
        fps,
        ema,
    );

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
        ? "---"
        : roundToDecimals((Date.now() - value) / 1000, 1).toFixed(1);
}

const STAT_MAP = [
// pos is displayed in bottom statusbar now:: row:col
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
        getValue: (state: GameState) =>
            state.ctx.physics.collision ? "YES" : "NO",
    },
    {
        name: "prediction",
        getValue: (state: GameState) =>
            state.ctx.physics.prediction ? "YES" : "NO",
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
    rowGap?: number;
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
    lines: number;
};
function getDevStatsStyles(
    viewport: Viewport,
    { scale }: MapConfig,
    canvas: HTMLCanvasElement,
): StylesWithContext {
    const LINES = STAT_MAP.length;
    const FONT_SIZE = 16;

    const styles = getBoxStyles(
        LINES,
        FONT_SIZE,
        10,
        2,
        (STAT_NAME_LONGEST + 2) * 0.9,
        12,
        scale,
    );
    const fpsYEnd = 2 * styles.fontSize + 12 * scale;

    return {
        ctx: canvas.getContext("2d")!,
        x: viewport.width - styles.width,
        y: fpsYEnd + 10 * scale, // slight gap from the fps window
        ...styles,
    };
}

export function closeDevStats(
    state: GameState,
    viewport?: Viewport,
    config?: MapConfig,
) {
    const canvas = state.refs.overlay.value!;
    const d = STYLES.devStats(
        viewport ?? state.ctx.client.viewport,
        config ?? state.ctx.world.config,
        canvas,
    );
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export async function drawDevStats(state: GameState) {
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeDevStats(state, ...generateOldDimensions(state.ctx));
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
function generateHelpDimensions(
    viewport: Viewport,
    { tileSize }: MapConfig,
): RectDimensions {
    const heightTiles = 8;
    const bottomPaddingTiles = 0.5;
    const xPaddingTiles = 0.5;
    return {
        left: tileSize * xPaddingTiles,
        top:
            tileSize *
            (viewport.height / tileSize - heightTiles - bottomPaddingTiles), // 6 tiles up from bottom
        w: tileSize * (viewport.width / tileSize - 2 * xPaddingTiles),
        h: tileSize * heightTiles,
    };
}

function closeOldHelp(state: GameState, ctx: CanvasRenderingContext2D) {
    if (hasScaleChanged(state.ctx)) {
        const HELP = generateHelpDimensions(
            ...generateOldDimensions(state.ctx),
        );
        ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    }
}

const HELP_DIMENSIONS: Record<string, RectDimensions> = {};
const getHelpDimensions = (viewport: Viewport, config: MapConfig) => {
    if (!HELP_DIMENSIONS[config.tileSize]) {
        HELP_DIMENSIONS[config.tileSize] = STYLES.help(
            viewport,
            config,
        );
    }
    return HELP_DIMENSIONS[config.tileSize];
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
const helpTextPadding = {
    x: 1,
    y: 1,
};

export function drawHelp(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldHelp(state, ctx);
    const { config } = state.ctx.world;

    const HELP = getHelpDimensions(state.ctx.client.viewport, config);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(HELP.left, HELP.top, HELP.w, HELP.h);

    ctx.font = `bold ${18 * config.scale}px mono`;
    ctx.fillStyle = "white";
    const leftPadding = HELP.left + config.tileSize * helpTextPadding.x;
    const topPadding = HELP.top + 20 * config.scale;
    const columnPadding = 224 * config.scale;
    for (let i = 0; i < HELP_TEXT.length; i++) {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        ctx.fillText(
            HELP_TEXT[i],
            leftPadding + col * columnPadding,
            topPadding + config.tileSize * (helpTextPadding.y + row),
        );
    }
}

export function closeHelp(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    closeOldHelp(state, ctx);

    const HELP = STYLES.help(
        state.ctx.client.viewport,
        state.ctx.world.config,
    );
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
        const [_, { tileSize }] = generateOldDimensions(state.ctx);
        // clear old rect
        ctx.clearRect(
            tileSize * 0.5,
            tileSize * 0.5,
            tileSize * 4,
            tileSize * 2.5,
        );
    }
    const { config } = state.ctx.world;
    // clear new rect
    ctx.clearRect(
        config.tileSize * 0.5,
        config.tileSize * 0.5,
        config.tileSize * 4,
        config.tileSize * 2.5,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
        config.tileSize * 0.5,
        config.tileSize * 0.5,
        config.tileSize * 4,
        config.tileSize * 2.5,
    );
    ctx.font = `bold ${16 * config.scale}px mono`;
    for (let i = 0; i < TEXT_HELP_HINT.length; i++) {
        ctx.fillStyle = TEXT_HELP_HINT[i].color;
        ctx.fillText(
            TEXT_HELP_HINT[i].text,
            config.tileSize * 0.5 + config.tileSize / 4,
            config.tileSize * 1 +
                config.tileSize / 8 +
                ((config.tileSize * 3) / 4) * i,
        );
    }
}

// ****************************************************************
//
//                      AFK styles
//
// ****************************************************************

/** @returns [x, y, width, height] array */
function getAfkRect(viewport: Viewport, { tileSize }: MapConfig) {
    return [
        tileSize * 6.5,
        tileSize / 2,
        viewport.width - tileSize * 13,
        tileSize * 5,
    ] as const; // x, y, width, height
}

function clearAfkRect(
    viewport: Viewport,
    config: MapConfig,
    ctx: CanvasRenderingContext2D,
) {
    ctx.clearRect(...getAfkRect(viewport, config));
}
// generateOldDimensions(state.ctx.world)
export function closeAfk(state: GameState) {
    const ctx = state.refs.overlay.value!.getContext("2d")!;
    clearAfkRect(state.ctx.client.viewport, state.ctx.world.config, ctx);
    if (!hasScaleChanged(state.ctx)) return;
    clearAfkRect(...generateOldDimensions(state.ctx), ctx);
}

export function drawAfk(state: GameState) {
    closeAfk(state);

    const ctx = state.refs.overlay.value!.getContext("2d")!;

    const dimensions = getAfkRect(
        state.ctx.client.viewport,
        state.ctx.world.config,
    );

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(...dimensions);

    ctx.font = `bold ${24 * state.ctx.world.config.scale}px mono`;
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

function getStatusStyles(
    viewport: Viewport,
    { scale }: MapConfig,
    canvas: HTMLCanvasElement,
): StylesWithContext & { rowGap: number } {
    const LINES = 2;
    const FONT_SIZE = 16;
    const styles = getBoxStyles(LINES, FONT_SIZE, 10, 0, 0, 0, scale);
    return {
        ctx: canvas.getContext("2d")!,
        x: 0,
        y: viewport.height - styles.height,
        rowGap: 0,
        ...styles,
        width: viewport.width,
    };
}

function closeStatus(
    state: GameState,
    viewport?: Viewport,
    config?: MapConfig,
) {
    const canvas = state.refs.overlay.value!;
    const d = STYLES.status(
        viewport ?? state.ctx.client.viewport,
        config ?? state.ctx.world.config,
        canvas,
    );
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

const STYLES = {
    status: getStatusStyles,
    help: generateHelpDimensions,
    devStats: getDevStatsStyles,
};

export function drawStatus(state: GameState) {
    // this happens for everything, could probably make a map
    if (hasScaleChanged(state.ctx)) {
        // clear old rect
        closeStatus(state, ...generateOldDimensions(state.ctx));
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

const CHUNK_OVERLAY = {
    width: 160,
    height: 160,
};
export function drawChunkOverlay(state: GameState) {
    const { cx, cy } = chunkService.getChunkSlot(
        state.ctx.client.player?.pos ?? { x: 0, y: 0 },
    );
    const canvas = state.refs.overlay.value!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CHUNK_OVERLAY.width, CHUNK_OVERLAY.height);

    // draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, CHUNK_OVERLAY.width, CHUNK_OVERLAY.height);
    const FONT_SIZE = 16;

    // current chunk slot
    ctx.font = `bold ${FONT_SIZE}px mono`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 31, 31, 0.85)";
    ctx.fillText(`chunk: ${cx},${cy}`, 6, FONT_SIZE + 2);
    const viewportOriginSlot = `${
        state.ctx.client.viewport.origin.x / state.ctx.world.config.tileSize
    },${state.ctx.client.viewport.origin.y / state.ctx.world.config.tileSize}`;
    const viewportOrigin = `${state.ctx.client.viewport.origin.x},${state.ctx.client.viewport.origin.y}`;
    ctx.fillText(
        `${viewportOriginSlot} (${viewportOrigin}px)`,
        6,
        (FONT_SIZE + 2) * 2,
    );

    // visible chunks:
    if (!__visibleChunks.length) return;

    console.log("drawing chunk overlay::", { visibleChunks: __visibleChunks });
    const [minX, minY] = chunkService.parseKey(__visibleChunks?.[0]);
    __visibleChunks.forEach((key) => {
        const [cx, cy] = chunkService.parseKey(key);
        const col = cx - minX;
        const row = cy - minY;
        ctx.fillText(
            `${cx},${cy}`,
            6 + col * 40,
            (FONT_SIZE + 2) * 2 + 26 * (row + 1),
        );
    });
}
