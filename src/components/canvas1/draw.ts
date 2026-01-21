import {
    DIMENSIONS,
    HOT_PINK,
    OBJECT_COLOR_MAP,
    TILE_COLOR_MAP,
} from "./constants";
import { MapDimensions, MapObject, Player, World } from "./types";

//
//
// // e.g. tracking dirty tiles and only redrawing them:
// const dirtyTiles = [{x:5, y:5}, {x:6, y:5}];
// dirtyTiles.forEach(t => drawTile(t.x, t.y));

function drawObject(
    { dimensions }: World,
    ctx: CanvasRenderingContext2D,
    obj: MapObject,
) {
    ctx.fillStyle = OBJECT_COLOR_MAP[obj.type];
    ctx.strokeStyle = HOT_PINK;
    const WIDTH = 2;
    ctx.lineWidth = WIDTH;

    ctx.beginPath();
    ctx.rect(
        obj.pos.x * dimensions.tileSize,
        obj.pos.y * dimensions.tileSize,
        dimensions.tileSize,
        dimensions.tileSize,
    );
    ctx.fill();
    ctx.rect(
        obj.pos.x * dimensions.tileSize + WIDTH / 2,
        obj.pos.y * dimensions.tileSize + WIDTH / 2,
        dimensions.tileSize - WIDTH,
        dimensions.tileSize - WIDTH,
    );
    ctx.stroke();
}
function drawObjects(world: World, objectsCanvas: HTMLCanvasElement) {
    const objCtx = objectsCanvas.getContext("2d")!;

    objCtx.clearRect(0, 0, objectsCanvas.width, objectsCanvas.height);
    for (const obj of world.objects) {
        drawObject(world, objCtx, obj);
    }
}

function drawPlayer(
    { dimensions }: World,
    ctx: CanvasRenderingContext2D,
    player: Player,
) {
    ctx.fillStyle = player.color;
    const x = player.pos.x * dimensions.tileSize;
    const y = player.pos.y * dimensions.tileSize;
    ctx.fillRect(x, y, dimensions.tileSize, DIMENSIONS.tileSize);
    ctx.font = "bold 24px serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeText(player.id, x + dimensions.tileSize / 2, y + dimensions.tileSize / 2 + 3);
    drawPlayerDirection(dimensions, ctx, player);
}

function drawPlayers(world: World, playersCanvas: HTMLCanvasElement) {
    const ctx = playersCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, playersCanvas.width, playersCanvas.height);
    // draw others
    for (const player of world.otherPlayers) {
        drawPlayer(world, ctx, player);
    }
    // draw self
    drawPlayer(world, ctx, {...world.player, id: '0'}); // override the id for now
}

function drawPlayerDirection(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
    player: Player,
) {
    const x = player.pos.x * dimensions.tileSize;
    const y = player.pos.y * dimensions.tileSize;
    // drawing a direction arrow:
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    if (player.dir === "E") {
        ctx.moveTo(x + dimensions.tileSize * 3/4, y + dimensions.tileSize * 1/4);
        ctx.lineTo(x + dimensions.tileSize, y + dimensions.tileSize / 2); // right center
        ctx.lineTo(x + dimensions.tileSize * 3/4, y + dimensions.tileSize * 3/4);
    } else if (player.dir === "W") {
        ctx.moveTo(x + dimensions.tileSize * 1/4, y + dimensions.tileSize * 1/4);
        ctx.lineTo(x, y + dimensions.tileSize / 2); // left center
        ctx.lineTo(x + dimensions.tileSize * 1/4, y + dimensions.tileSize * 3/4);
    } else if (player.dir === "N") {
        ctx.moveTo(x + dimensions.tileSize * 1/4, y + dimensions.tileSize * 1/4);
        ctx.lineTo(x + dimensions.tileSize / 2, y); // top center
        ctx.lineTo(x + dimensions.tileSize * 3/4, y + dimensions.tileSize * 1/4);
    } else if (player.dir === "S") {
        ctx.moveTo(x + dimensions.tileSize * 1/4, y + dimensions.tileSize * 3/4);
        ctx.lineTo(x + dimensions.tileSize / 2, y + dimensions.tileSize); // bottom center
        ctx.lineTo(x + dimensions.tileSize * 3/4, y + dimensions.tileSize * 3/4);
    }
    ctx.stroke();
}

function drawFps(overlayCanvas: HTMLCanvasElement, fps: string, ema?: string) {
    const heightFactor = ema !== undefined ? 2 : 1;
    const overlayCtx = overlayCanvas.getContext("2d")!;
    const fontSize = 16;
    const width = 5 * fontSize + fps.length * fontSize * 0.6; // 16 * 4 = 64
    const height = heightFactor * fontSize + 12;
    const x = overlayCanvas.width - width;
    const y = 0;
    const leftPadding = 10;
    const textY = fontSize + 2;
    overlayCtx.clearRect(x, y, width, height);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
    overlayCtx.fillRect(x, y, width, height);
    overlayCtx.font = `bold ${fontSize}px mono`;
    overlayCtx.fillStyle = "red";
    overlayCtx.fillText(` fps: ${fps}`, x + leftPadding, textY);
    if (ema !== undefined) {
        const adjustedTextY = heightFactor * fontSize + 2;
        overlayCtx.fillText(`ema5: ${ema}`, x + leftPadding, adjustedTextY);
    }
}

function drawOffscreenMap(world: World) {
    const dimensions = world.dimensions;
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.canvasWidth;
    canvas.height = dimensions.canvasHeight;
    const offscreenCtx = canvas.getContext("2d")!;

    // Draw map tiles once
    for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            offscreenCtx.fillStyle = TILE_COLOR_MAP[world.map[y][x]];
            offscreenCtx.fillRect(
                x * dimensions.tileSize,
                y * dimensions.tileSize,
                dimensions.tileSize,
                dimensions.tileSize,
            );
        }
    }
    return canvas;
}

function drawVisibleMap(
    mapCanvas: HTMLCanvasElement,
    offscreenCanvas: HTMLCanvasElement,
) {
    const mapCtx = mapCanvas.getContext("2d")!;
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    // draw map (blit from offscreen)
    mapCtx.drawImage(offscreenCanvas, 0, 0);
}

type RectDimensions = { left: number; top: number; w: number; h: number };
const generateHelpDimensions = ({ dimensions }: World) => {
    const heightTiles = 8;
    const bottomPaddingTiles = 0.5;
    const xPaddingTiles = 0.5;
    return {
        left: dimensions.tileSize * xPaddingTiles,
        top:
            dimensions.tileSize *
            (dimensions.height - heightTiles - bottomPaddingTiles), // 6 tiles up from bottom
        w: dimensions.canvasWidth - dimensions.tileSize * (2 * xPaddingTiles),
        h: dimensions.tileSize * heightTiles,
    };
};
let HELP_DIMENSIONS: RectDimensions | undefined;
const getHelpDimensions = (world: World) => {
    if (!HELP_DIMENSIONS) {
        HELP_DIMENSIONS = generateHelpDimensions(world);
    }
    return HELP_DIMENSIONS;
};
const HELP_TEXT = [
    "h: Move left",
    "l: Move right",
    "k: Move up",
    "j: Move down",
    "w: Jump right",
    "b: Jump left",
];
function drawHelp(world: World, overlayCtx: CanvasRenderingContext2D) {
    const HELP = getHelpDimensions(world);
    overlayCtx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.4)";
    overlayCtx.fillRect(HELP.left, HELP.top, HELP.w, HELP.h);

    overlayCtx.font = `bold 18px mono`;
    overlayCtx.fillStyle = "white";
    const helpTextPadding = {
        x: 1,
        y: 1,
    };
    for (let i = 0; i < HELP_TEXT.length; i++) {
        overlayCtx.fillText(
            HELP_TEXT[i],
            HELP.left + world.dimensions.tileSize * helpTextPadding.x,
            HELP.top + world.dimensions.tileSize * (helpTextPadding.y + i) + 20,
        );
    }
}
function closeHelp(world: World, overlayCtx: CanvasRenderingContext2D) {
    const HELP = getHelpDimensions(world);
    overlayCtx.clearRect(HELP.left, HELP.top, HELP.w, HELP.h);
}

function drawAfk(world: World, overlayCtx: CanvasRenderingContext2D) {
    overlayCtx.clearRect(
        world.dimensions.tileSize * 6.5,
        world.dimensions.tileSize / 2,
        world.dimensions.canvasWidth - world.dimensions.tileSize * 13,
        world.dimensions.tileSize * 4,
    );
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
    overlayCtx.fillRect(
        world.dimensions.tileSize * 6.5,
        world.dimensions.tileSize / 2,
        world.dimensions.canvasWidth - world.dimensions.tileSize * 13,
        world.dimensions.tileSize * 4,
    );
    overlayCtx.font = `bold 24px mono`;
    overlayCtx.fillStyle = "red";
    overlayCtx.fillText(`You are AFK!`, world.dimensions.tileSize * 15, world.dimensions.tileSize * 2.5);
}

const draw = {
    fps: drawFps,
    players: drawPlayers,
    player: drawPlayer,
    objects: drawObjects,
    direction: drawPlayerDirection,
    help: drawHelp,
    closeHelp,
    offscreenMap: drawOffscreenMap,
    visibleMap: drawVisibleMap,
    afk: drawAfk,
};
export default draw;
