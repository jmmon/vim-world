import { WorldEntity } from "~/types/worldTypes";
import {
    HOT_PINK,
    ITEM_COLOR_MAP,
    OBJECT_COLOR_MAP,
} from "../../components/canvas1/constants";
import { clearOldCanvas, shadeColor } from "./utils";
import { GameState } from "~/hooks/useState";
import { ITEMS_WITH_IDS } from "~/server/objects";
import { MapConfig, mulberry32 } from "~/server/map";
import { getViewportCoordsAsPx, isWithinViewport } from "~/simulation/shared/helpers";

const KEY_OFFSET_PERCENT = 0.05;
function drawObjectKeys(
    config: MapConfig,
    ctx: CanvasRenderingContext2D,
    obj: WorldEntity,
    x: number,
    y: number,
) {
    const { tileSize, scale } = config;
    const keyOffetRight = 1 - KEY_OFFSET_PERCENT * 2;
    ctx.fillStyle = "#00000020";
    ctx.fillRect(
        (x + KEY_OFFSET_PERCENT) * tileSize,
        (y + KEY_OFFSET_PERCENT) * tileSize,
        tileSize * keyOffetRight,
        tileSize * keyOffetRight,
    );
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.font = `bold ${12 * scale}px mono`;
    ctx.fillText(
        obj!.interactable!.selectors![0],
        (x + KEY_OFFSET_PERCENT) * tileSize,
        (y + 0.75) * tileSize,
    );
    ctx.textAlign = "right";
    ctx.fillText(
        obj!.interactable!.selectors![1],
        (x + keyOffetRight) * tileSize,
        (y + 0.75) * tileSize,
    );
}

// draws the first item on the object
function drawObjectItems(
    config: MapConfig,
    ctx: CanvasRenderingContext2D,
    obj: WorldEntity,
    x: number,
    y: number,
    LINE_WIDTH: number,
) {
    const { tileSize } = config;
    const item = ITEMS_WITH_IDS.find((i) => i.id === obj!.container!.itemIds[0])!;
    ctx.strokeStyle = ITEM_COLOR_MAP[item.quality];
    ctx.lineWidth = LINE_WIDTH * 1.2;
    ctx.beginPath();
    ctx.ellipse(
        (x + 0.5) * tileSize,
        (y + 0.25) * tileSize,
        tileSize / 5,
        tileSize / 8,
        0,
        0 + Math.PI * 2 * 0.4,
        0 + Math.PI * 2 * 1.1,
    );
    ctx.stroke();
}

function drawObject(
    state: GameState,
    ctx: CanvasRenderingContext2D,
    obj: WorldEntity,
) {
    const { tileSize, scale } = state.ctx.world.config;
    // need viewport coords, not chunk coords
    const objPosPx = {x: obj.pos!.x * tileSize, y: obj.pos!.y * tileSize};
    const {px, py} = getViewportCoordsAsPx(objPosPx, state.ctx.client.viewport.origin);
    // const { lx, ly } = chunkService.getLocalChunkCoords(obj.pos!);
    const {lx, ly} = {lx: px / tileSize, ly: py / tileSize};
    const rng = mulberry32(state.ctx.world.zone.seed); // world rng for world objects
    const baseColor = OBJECT_COLOR_MAP[obj.type];
    const lightnessOffset = rng() * 20 - 10;
    const adjusted = shadeColor(baseColor, lightnessOffset);
    ctx.fillStyle = adjusted;

    // border
    ctx.strokeStyle = HOT_PINK; 
    const LINE_WIDTH = 2 * scale;
    ctx.lineWidth = LINE_WIDTH;

    // background
    ctx.beginPath();
    ctx.rect(lx * tileSize, ly * tileSize, tileSize, tileSize);
    ctx.fill();

    // border
    ctx.rect(
        lx * tileSize + LINE_WIDTH / 2,
        ly * tileSize + LINE_WIDTH / 2,
        tileSize - LINE_WIDTH,
        tileSize - LINE_WIDTH,
    );
    ctx.stroke();

    if (obj?.interactable?.selectors.length)
        drawObjectKeys(state.ctx.world.config, ctx, obj, lx, ly);
    if (obj?.container?.itemIds.length)
        drawObjectItems(state.ctx.world.config, ctx, obj, lx, ly, LINE_WIDTH);
}


export function drawObjects(state: GameState) {
    const canvas = state.refs.objects.value!;
    const ctx = canvas.getContext("2d")!;

    clearOldCanvas(state.ctx, ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { tileSize } = state.ctx.world.config;
    Array.from(state.ctx.world.entities.values()).forEach((entity) => {
        if (entity.pos === undefined) {
            console.log("skipping object with undefined pos:", entity.id);
            return;
        }

        const {x, y} = entity.pos;
        if (!isWithinViewport(state.ctx.client.viewport, {px: x * tileSize, py: y * tileSize})) {
            // console.log("outside viewport:", {id: entity.id, pos: entity.pos, viewport: state.ctx.client.viewport});
            return;
        }
        console.log('within viewport! drawing entity::', entity);
        drawObject(state, ctx, entity);
    });
}
