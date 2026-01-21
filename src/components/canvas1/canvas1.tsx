import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { DIMENSIONS, HOT_PINK, getRandomHexColor } from "./constants";
import {
    ClientActionMessage,
    ServerAckMessage,
    Prediction,
    ServerMessage,
    ServerPlayerMoveMessage,
} from "~/fsm/types";
import draw from "./draw";
import { MapObject, Player, TileType, World } from "./types";
import { map } from "./map";
import useVimFSM from "~/fsm/useVimFSM";
import { initFpsCounter } from "./utils";
import { applyActionToWorld } from "~/fsm/movement";

const objectsList: MapObject[] = [
    { type: "tree", pos: { x: 0, y: 0 }, walkable: false },
    { type: "chest", pos: { x: 0, y: 0 }, walkable: true },
];

export const WALKABLE: TileType[] = ["grass", "dirt"];
// const WALKABLE_MAP_TILES = map.
// want to get a list of all coordinates that are walkable:
const WALKABLE_MAP_TILES = map.reduce(
    (accum, row, y) => {
        row.forEach((tile, x) => {
            if (WALKABLE.includes(tile)) {
                accum.push({ x, y });
            }
        });
        return accum;
    },
    [] as { x: number; y: number }[],
);

const objects = objectsList.map((obj) => {
    const random = Math.floor(Math.random() * WALKABLE_MAP_TILES.length);
    const { x, y } = WALKABLE_MAP_TILES[random];
    console.assert(
        !!WALKABLE_MAP_TILES[random],
        "error indexing walkable map tiles!",
    );
    return {
        ...obj,
        pos: {
            x,
            y,
        },
    };
});
// objects.sort((a, b) => a.y - b.y); // Draw lower objects later for depth
//

const otherPlayers: Player[] = [
    { id: "1", pos: { x: 10, y: 10 }, dir: "left", color: getRandomHexColor() },
    { id: "2", pos: { x: 11, y: 11 }, dir: "up", color: getRandomHexColor() },
    { id: "3", pos: { x: 12, y: 12 }, dir: "down", color: getRandomHexColor() },
];
const player: Player = {
    id: "0",
    pos: { x: 0, y: 0 },
    dir: "right",
    color: HOT_PINK,
};

export const WORLD: World = {
    dimensions: DIMENSIONS,
    map: map,
    player: player,
    otherPlayers: [...otherPlayers],
    objects,
    help: {
        isOpen: false,
    },
};

//
//
// // e.g. tracking dirty tiles and only redrawing them:
// const dirtyTiles = [{x:5, y:5}, {x:6, y:5}];
// dirtyTiles.forEach(t => drawTile(t.x, t.y));

const Canvas1 = component$(() => {
    const offscreenMap = useSignal<HTMLCanvasElement>();

    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();



    const onMessage$ = $((event: MessageEvent<string>, ws: NoSerialize<WebSocket>) => {
        console.log("onMessage:", event);
    });
    const onInit$ = $((ws: NoSerialize<WebSocket>) => {
    });
    const ws = useWebSocket(onMessage$, onInit$);
    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    useVimFSM(
        $(async (action): Promise<void> => {
            const seq = await nextSeq();
            // 0. Add to prediction buffer
            predictionBuffer.value.push({
                seq,
                action,
                snapshotBefore: { ...WORLD.player },
            });

            // 1. Apply local prediction
            applyActionToWorld(
                WORLD.player,
                action,
                overlayRef.value!.getContext("2d")!,
            );

        }),
    );

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        // initialize offscreen canvas of map tiles
        const offscreenCanvas = draw.offscreenMap();
        offscreenMap.value = offscreenCanvas;

        draw.visibleMap(mapRef.value!, offscreenCanvas);

        const countFps = initFpsCounter();
        function loop() {
            const {fps, fpsEma} = countFps();

            draw.objects(objectsRef.value!, WORLD);
            draw.players(playersRef.value!, WORLD);
            draw.fps(overlayRef.value!, fps, fpsEma);

            requestAnimationFrame(loop);
        }

        loop();
    });

    return (
        <div
            style={{
                position: "relative",
                width: DIMENSIONS.canvasWidth + "px",
                height: DIMENSIONS.canvasHeight + "px",
            }}
        >
            <canvas
                ref={mapRef}
                width={DIMENSIONS.canvasWidth}
                height={DIMENSIONS.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={objectsRef}
                width={DIMENSIONS.canvasWidth}
                height={DIMENSIONS.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={playersRef}
                width={DIMENSIONS.canvasWidth}
                height={DIMENSIONS.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={overlayRef}
                width={DIMENSIONS.canvasWidth}
                height={DIMENSIONS.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
        </div>
    );
});

export default Canvas1;
