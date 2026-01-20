import { WORLD } from "./canvas1";
import { DIMENSIONS, HOT_PINK, OBJECT_COLOR_MAP, TILE_COLOR_MAP } from "./constants";
import { MapObject, Player, World } from "./types";

function drawObject(ctx: CanvasRenderingContext2D, obj: MapObject) {
    ctx.fillStyle = OBJECT_COLOR_MAP[obj.type];
    ctx.strokeStyle = HOT_PINK;
    const WIDTH = 2;
    ctx.lineWidth = WIDTH;

    ctx.beginPath();
    ctx.rect(
        obj.pos.x * DIMENSIONS.tileSize,
        obj.pos.y * DIMENSIONS.tileSize,
        DIMENSIONS.tileSize,
        DIMENSIONS.tileSize,
    );
    ctx.fill();
    ctx.rect(
        obj.pos.x * DIMENSIONS.tileSize + WIDTH / 2,
        obj.pos.y * DIMENSIONS.tileSize + WIDTH / 2,
        DIMENSIONS.tileSize - WIDTH,
        DIMENSIONS.tileSize - WIDTH,
    );
    ctx.stroke();
}
function drawObjects(objectsCanvas: HTMLCanvasElement, world: World) {
    const objCtx = objectsCanvas.getContext('2d')!;

    objCtx.clearRect(0, 0, objectsCanvas.width, objectsCanvas.height);
    for (const obj of world.objects) {
        drawObject(objCtx, obj);
    }
}

function drawPlayers(playersCanvas: HTMLCanvasElement, world: World) {
    const ctx = playersCanvas.getContext('2d')!;
    ctx.clearRect(
        0,
        0,
        playersCanvas.width,
        playersCanvas.height,
    );
    // draw others
    for (const player of world.otherPlayers) {
        drawPlayer(ctx, player);
    }
    // draw self
    drawPlayer(ctx, world.player);
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
    ctx.fillStyle = player.color;
    const x = player.pos.x * DIMENSIONS.tileSize;
    const y = player.pos.y * DIMENSIONS.tileSize;
    ctx.fillRect(x, y, DIMENSIONS.tileSize, DIMENSIONS.tileSize);
    ctx.font = "bold 24px serif";
    ctx.strokeText(player.id, x + (DIMENSIONS.tileSize - 18) / 2, y + 24);
    drawPlayerDirection(ctx, player);
}

function drawPlayerDirection(ctx: CanvasRenderingContext2D, player: Player) {
    const x = player.pos.x * DIMENSIONS.tileSize;
    const y = player.pos.y * DIMENSIONS.tileSize;
    // drawing a direction arrow:
    ctx.strokeStyle = "black";
    ctx.beginPath();
    if (player.dir === "right") {
        ctx.moveTo(x + DIMENSIONS.tileSize / 2, y);
        ctx.lineTo(x + DIMENSIONS.tileSize, y + DIMENSIONS.tileSize / 2);
        ctx.lineTo(x + DIMENSIONS.tileSize / 2, y + DIMENSIONS.tileSize);
    } else if (player.dir === "left") {
        ctx.moveTo(x + DIMENSIONS.tileSize / 2, y);
        ctx.lineTo(x, y + DIMENSIONS.tileSize / 2);
        ctx.lineTo(x + DIMENSIONS.tileSize / 2, y + DIMENSIONS.tileSize);
    } else if (player.dir === "up") {
        ctx.moveTo(x, y + DIMENSIONS.tileSize / 2);
        ctx.lineTo(x + DIMENSIONS.tileSize / 2, y);
        ctx.lineTo(x + DIMENSIONS.tileSize, y + DIMENSIONS.tileSize / 2);
    } else if (player.dir === "down") {
        ctx.moveTo(x, y + DIMENSIONS.tileSize / 2);
        ctx.lineTo(x + DIMENSIONS.tileSize / 2, y + DIMENSIONS.tileSize);
        ctx.lineTo(x + DIMENSIONS.tileSize, y + DIMENSIONS.tileSize / 2);
    }
    ctx.stroke();
}

function drawFps(overlayCanvas: HTMLCanvasElement, fps: string, ema?: string) {
    const heightFactor = ema !== undefined ? 2 : 1;
    const overlayCtx = overlayCanvas.getContext("2d")!;
    const fontSize = 16;
    const width = 5 * fontSize + ((fps.length) * fontSize * 0.6); // 16 * 4 = 64
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

function drawOffscreenMap() {
    const canvas = document.createElement("canvas");
    canvas.width = DIMENSIONS.canvasWidth;
    canvas.height = DIMENSIONS.canvasHeight;
    const offscreenCtx = canvas.getContext("2d")!;

    // Draw map tiles once
    for (let y = 0; y < DIMENSIONS.height; y++) {
        for (let x = 0; x < DIMENSIONS.width; x++) {
            offscreenCtx.fillStyle = TILE_COLOR_MAP[WORLD.map[y][x]];
            offscreenCtx.fillRect(
                x * DIMENSIONS.tileSize,
                y * DIMENSIONS.tileSize,
                DIMENSIONS.tileSize,
                DIMENSIONS.tileSize,
            );
        }
    }
    return canvas;
}

function drawVisibleMap(mapCanvas: HTMLCanvasElement, offscreenCanvas: HTMLCanvasElement) {
    const mapCtx = mapCanvas.getContext("2d")!;
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    // draw map (blit from offscreen)
    mapCtx.drawImage(offscreenCanvas, 0, 0);
}

const HELP = {
    x: DIMENSIONS.tileSize * 2,
    y: DIMENSIONS.tileSize * 2,
    w: DIMENSIONS.canvasWidth - DIMENSIONS.tileSize * 4,
    h: DIMENSIONS.canvasHeight - DIMENSIONS.tileSize * 4,
}
function drawHelp(overlayCtx: CanvasRenderingContext2D) {
    overlayCtx.clearRect(HELP.x, HELP.y, HELP.w, HELP.h);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
    overlayCtx.fillRect(HELP.x, HELP.y, HELP.w, HELP.h);
}
function closeHelp(overlayCtx: CanvasRenderingContext2D) {
    overlayCtx.clearRect(HELP.x, HELP.y, HELP.w, HELP.h);
}

const draw = {
    fps: drawFps,
    players: drawPlayers,
    objects: drawObjects,
    direction: drawPlayerDirection,
    help: drawHelp,
    closeHelp,
    offscreenMap: drawOffscreenMap,
    visibleMap: drawVisibleMap,
};
export default draw;
