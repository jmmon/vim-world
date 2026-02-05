import { MapDimensions, WorldEntity } from "~/types/worldTypes";
import { HOT_PINK, ITEM_COLOR_MAP, OBJECT_COLOR_MAP } from "../../components/canvas1/constants";
import { closeOldCanvas } from "./utils";
import { GameState } from "~/hooks/useState";
import { items } from "~/server/objects";

export function drawObject(
    dimensions: MapDimensions,
    ctx: CanvasRenderingContext2D,
    obj: WorldEntity,
) {
    ctx.fillStyle = OBJECT_COLOR_MAP[obj.type];

    ctx.strokeStyle = HOT_PINK;
    const LINE_WIDTH = 2 * dimensions.scale;
    ctx.lineWidth = LINE_WIDTH;

    ctx.beginPath();
    ctx.rect(
        obj.pos!.x * dimensions.tileSize,
        obj.pos!.y * dimensions.tileSize,
        dimensions.tileSize,
        dimensions.tileSize,
    );
    ctx.fill();
    ctx.rect(
        obj.pos!.x * dimensions.tileSize + LINE_WIDTH / 2,
        obj.pos!.y * dimensions.tileSize + LINE_WIDTH / 2,
        dimensions.tileSize - LINE_WIDTH,
        dimensions.tileSize - LINE_WIDTH,
    );
    ctx.stroke();

    if (obj?.interactable?.selectors.length) drawObjectKeys(dimensions, ctx, obj);
    if (obj?.container?.itemIds.length) drawObjectItems(dimensions, ctx, obj, LINE_WIDTH);
}

const KEY_OFFSET_PERCENT = 0.05
function drawObjectKeys(dimensions: MapDimensions, ctx: CanvasRenderingContext2D, obj: WorldEntity) {
    const keyOffetRight = (1 - (KEY_OFFSET_PERCENT * 2));
    ctx.fillStyle = "#00000020";
    ctx.fillRect(
        (obj.pos!.x + KEY_OFFSET_PERCENT) * dimensions.tileSize,
        (obj.pos!.y + KEY_OFFSET_PERCENT) * dimensions.tileSize,
        dimensions.tileSize * keyOffetRight,
        dimensions.tileSize * keyOffetRight,
    );
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.font = `bold ${12 * dimensions.scale}px mono`;
    ctx.fillText(obj!.interactable!.selectors![0], (obj.pos!.x + KEY_OFFSET_PERCENT) * dimensions.tileSize, (obj.pos!.y + 0.75) * dimensions.tileSize);
    ctx.textAlign = "right";
    ctx.fillText(obj!.interactable!.selectors![1], (obj.pos!.x + keyOffetRight) * dimensions.tileSize, (obj.pos!.y + 0.75) * dimensions.tileSize);

}

// draws the first item on the object
function drawObjectItems(dimensions: MapDimensions, ctx: CanvasRenderingContext2D, obj: WorldEntity, LINE_WIDTH: number) {
    const item = items.find((i) => i.id === obj!.container!.itemIds[0])!;
    ctx.strokeStyle = ITEM_COLOR_MAP[item.quality];
    ctx.lineWidth = LINE_WIDTH * 1.2;
    ctx.beginPath();
    ctx.ellipse(
        (obj.pos!.x + 0.5) * dimensions.tileSize,
        (obj.pos!.y + 0.25) * dimensions.tileSize,
        dimensions.tileSize / 5,
        dimensions.tileSize / 8,
        0,
        0 + Math.PI * 2 * 0.4,
        0 + Math.PI * 2 * 1.1,
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
    Array.from(state.ctx.world.entities.values()).forEach((entity) => {
        if (entity.pos === undefined) {
            console.log('skipping object with id:', entity.id);
            return;
        }
        drawObject(state.ctx.world.dimensions, ctx, entity);
    });
}


