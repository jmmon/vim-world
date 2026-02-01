import { MapDimensions, MapObjWithPos } from "~/types/worldTypes";
import { HOT_PINK, ITEM_COLOR_MAP, OBJECT_COLOR_MAP } from "../../components/canvas1/constants";
import { closeOldCanvas, objHasPos } from "./utils";
import { GameState } from "~/hooks/useState";
import { items } from "~/server/objects";

export function drawObject(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
    obj: MapObjWithPos,
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

    if (obj.itemIds?.length) {
        const item = items.find((i) => i.id === obj.itemIds?.[0])!;
        ctx.strokeStyle = ITEM_COLOR_MAP[item.quality];
        ctx.lineWidth = LINE_WIDTH * 1.2;
        ctx.beginPath();
        ctx.ellipse(
            (obj.pos.x + 0.5) * dimensions.tileSize,
            (obj.pos.y + 0.25) * dimensions.tileSize,
            dimensions.tileSize / 5,
            dimensions.tileSize / 8,
            0,
            0 + Math.PI * 2 * 0.4,
            0 + Math.PI * 2 * 1.1,
        );
        ctx.stroke();
        if (!obj.key) return;
        ctx.fillStyle = "#00000020";
        ctx.fillRect(
            (obj.pos.x + 0.25) * dimensions.tileSize,
            (obj.pos.y + 0.3) * dimensions.tileSize,
            dimensions.tileSize * 0.5,
            dimensions.tileSize * 0.6,
        );
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.font = `bold ${12 * dimensions.scale}px mono`;
        ctx.fillText(obj.key, (obj.pos.x + 0.5) * dimensions.tileSize, (obj.pos.y + 0.75) * dimensions.tileSize);

    }
}

export function drawObjects(
    state: GameState,
) {
    const ctx = state.refs.objects.value!.getContext("2d")!;
    // clear old rect
    closeOldCanvas(state.ctx, ctx);

    ctx.clearRect(0, 0, state.refs.objects.value!.width, state.refs.objects.value!.height);
    for (const obj of state.ctx.world.objects) {
        if (!objHasPos(obj)) {
             console.log('skipping object with id:', obj.id);
            continue;
        }
        drawObject(state.ctx.world.dimensions, ctx, obj);
    }
}


