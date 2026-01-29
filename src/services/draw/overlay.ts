import { LocalWorldWrapper, MapDimensions } from "../../components/canvas1/types";
import { generateOldDimensions, hasScaleChanged } from "./utils";

function getFpsStyles(
    dimensions: MapDimensions,
    canvas: HTMLCanvasElement,
    fps: string,
    ema?: string,
) {
    const lines = ema !== undefined ? 2 : 1;
    const fontSize = 16 * dimensions.scale;
    const width = 5 * fontSize + fps.length * fontSize * 0.6; // 16 * 4 = 64
    return {
        x: dimensions.canvasWidth - width,
        y: 0,
        width,
        height: lines * fontSize + 12 * dimensions.scale,
        leftPadding: 10 * dimensions.scale,
        fontSize,
        lines,
        textY: fontSize + 2 * dimensions.scale,
        ctx: canvas.getContext("2d")!,
    };
}

// clear old rect
function closeFps(
    state: LocalWorldWrapper,
    canvas: HTMLCanvasElement,
    fps: string,
    ema?: string,
) {
    const d = getFpsStyles(
        generateOldDimensions(state.world),
        canvas,
        fps,
        ema,
    );
    d.ctx.clearRect(d.x, d.y, d.width, d.height);
    return d;
}

export function drawFps(
    state: LocalWorldWrapper,
    canvas: HTMLCanvasElement,
    fps: string,
    ema?: string,
) {
    if (
        0 !== Math.round(state.world.dimensions.scale - state.world.lastScale)
    ) {
        // clear old rect
        closeFps(state, canvas, fps, ema);
    }
    // clear new rect
    const d = closeFps(state, canvas, fps, ema);

    // background
    d.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    d.ctx.fillRect(d.x, d.y, d.width, d.height);

    // fps
    d.ctx.font = `bold ${d.fontSize}px mono`;
    d.ctx.fillStyle = "red";
    d.ctx.fillText(` fps: ${fps}`, d.x + d.leftPadding, d.textY);

    // ema
    if (ema !== undefined) {
        d.ctx.fillText(
            `ema5: ${ema}`,
            d.x + d.leftPadding,
            d.lines * d.textY,
        );
    }
}

type RectDimensions = { left: number; top: number; w: number; h: number };
function closeOldHelp(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    if (hasScaleChanged(state)) {
        const HELP = generateHelpDimensions(generateOldDimensions(state.world));
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

export function drawHelp(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    closeOldHelp(state, ctx);

    const HELP = generateHelpDimensions(state.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(HELP.left, HELP.top, HELP.w, HELP.h);

    ctx.font = `bold ${18 * state.world.dimensions.scale}px mono`;
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
                state.world.dimensions.tileSize * helpTextPadding.x +
                col * (224 * state.world.dimensions.scale),
            HELP.top +
                state.world.dimensions.tileSize * (helpTextPadding.y + row) +
                20 * state.world.dimensions.scale,
        );
    }
}

export function closeHelp(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    closeOldHelp(state, ctx);

    const HELP = generateHelpDimensions(state.world.dimensions);
    ctx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
}

const TEXT_HELP_HINT = [
    { text: "Hint: type", color: "white" },
    { text: " :h<enter>", color: "#ffcc88" },
    { text: "to open Help", color: "white" },
];
export function drawHelpHint(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    if (hasScaleChanged(state)) {
        const { tileSize } = generateOldDimensions(state.world);
        ctx.clearRect(
            tileSize * 0.5,
            tileSize * 0.5,
            tileSize * 4,
            tileSize * 2.5,
        );
    }
    ctx.clearRect(
        state.world.dimensions.tileSize * 0.5,
        state.world.dimensions.tileSize * 0.5,
        state.world.dimensions.tileSize * 4,
        state.world.dimensions.tileSize * 2.5,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
        state.world.dimensions.tileSize * 0.5,
        state.world.dimensions.tileSize * 0.5,
        state.world.dimensions.tileSize * 4,
        state.world.dimensions.tileSize * 2.5,
    );
    ctx.font = `bold ${16 * state.world.dimensions.scale}px mono`;
    for (let i = 0; i < TEXT_HELP_HINT.length; i++) {
        ctx.fillStyle = TEXT_HELP_HINT[i].color;
        ctx.fillText(
            TEXT_HELP_HINT[i].text,
            state.world.dimensions.tileSize * 0.5 +
                state.world.dimensions.tileSize / 4,
            state.world.dimensions.tileSize * 1 +
                state.world.dimensions.tileSize / 8 +
                ((state.world.dimensions.tileSize * 3) / 4) * i,
        );
    }
}

function closeOldAfk(state: LocalWorldWrapper, ctx: CanvasRenderingContext2D) {
    if (hasScaleChanged(state)) {
        const dimensions = generateOldDimensions(state.world);
        ctx.clearRect(
            dimensions.tileSize * 6.5,
            dimensions.tileSize / 2,
            dimensions.canvasWidth -
                dimensions.tileSize * 13,
            dimensions.tileSize * 5,
        );
    }
}
export function closeAfk(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    closeOldAfk(state, ctx);
    ctx.clearRect(
        state.world.dimensions.tileSize * 6.5,
        state.world.dimensions.tileSize / 2,
        state.world.dimensions.canvasWidth -
            state.world.dimensions.tileSize * 13,
        state.world.dimensions.tileSize * 5,
    );
}

export function drawAfk(
    state: LocalWorldWrapper,
    ctx: CanvasRenderingContext2D,
) {
    closeOldAfk(state, ctx);
    ctx.clearRect(
        state.world.dimensions.tileSize * 6.5,
        state.world.dimensions.tileSize / 2,
        state.world.dimensions.canvasWidth -
            state.world.dimensions.tileSize * 13,
        state.world.dimensions.tileSize * 4,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
        state.world.dimensions.tileSize * 6.5,
        state.world.dimensions.tileSize / 2,
        state.world.dimensions.canvasWidth -
            state.world.dimensions.tileSize * 13,
        state.world.dimensions.tileSize * 4,
    );
    ctx.font = `bold ${24 * state.world.dimensions.scale}px mono`;
    ctx.fillStyle = "red";
    ctx.fillText(
        `You are AFK!`,
        state.world.dimensions.tileSize * 15,
        state.world.dimensions.tileSize * 2.5,
    );
}

