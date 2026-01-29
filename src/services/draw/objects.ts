import { HOT_PINK, OBJECT_COLOR_MAP } from "../../components/canvas1/constants";
import { LocalWorldWrapper, MapDimensions, MapObject } from "../../components/canvas1/types";
import { closeOldCanvas } from "./utils";

export function drawObject(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
    obj: MapObject,
) {
    ctx.fillStyle = OBJECT_COLOR_MAP[obj.type];
    ctx.strokeStyle = HOT_PINK;
    const LINE_WIDTH = 2 * dimensions.scale;
    ctx.lineWidth = LINE_WIDTH;

    ctx.beginPath();
    ctx.rect(
        obj.pos.x * dimensions.tileSize,
        obj.pos.y * dimensions.tileSize,
        dimensions.tileSize,
        dimensions.tileSize,
    );
    ctx.fill();
    ctx.rect(
        obj.pos.x * dimensions.tileSize + LINE_WIDTH / 2,
        obj.pos.y * dimensions.tileSize + LINE_WIDTH / 2,
        dimensions.tileSize - LINE_WIDTH,
        dimensions.tileSize - LINE_WIDTH,
    );
    ctx.stroke();
}

export function drawObjects(
    state: LocalWorldWrapper,
    canvas: HTMLCanvasElement,
) {
    const ctx = canvas.getContext("2d")!;
    // clear old rect
    closeOldCanvas(state, ctx);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obj of state.world.objects) {
        drawObject(state.world.dimensions, ctx, obj);
    }
}

