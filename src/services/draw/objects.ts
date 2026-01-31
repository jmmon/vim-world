import { MapDimensions, MapObject } from "~/types/worldTypes";
import { HOT_PINK, OBJECT_COLOR_MAP } from "../../components/canvas1/constants";
import { closeOldCanvas } from "./utils";
import { GameState } from "~/hooks/useState";

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
    state: GameState,
) {

    const ctx = state.refs.objects.value!.getContext("2d")!;
    // clear old rect
    closeOldCanvas(state.ctx, ctx);

    ctx.clearRect(0, 0, state.refs.objects.value!.width, state.refs.objects.value!.height);
    for (const obj of state.ctx.world.objects) {
        drawObject(state.ctx.world.dimensions, ctx, obj);
    }
}


