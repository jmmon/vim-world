import {
    component$,
    useSignal,
    useVisibleTask$,
} from "@builder.io/qwik";
import { GameState } from "~/hooks/useState";
import { MAP_CONFIG, zone } from "~/server/map";
import { ChunkKey } from "~/services/chunk";
import draw from "~/services/draw";

const allChunks: ChunkKey[] = [];
for (let x = 0; x < MAP_CONFIG.width; x++) {
    for (let y = 0; y < MAP_CONFIG.height; y++) {
        allChunks.push(`${x},${y}`);
    }
}

export default component$(() => {
    const offscreenMap = useSignal<HTMLCanvasElement>();
    const state = {
        refs: {
            offscreenMap,
        },
        ctx: {
            world: {
                config: MAP_CONFIG,
                zone,
            },
            client: {
                viewport: {
                    origin: { x: 0, y: 0 },
                    width: 1024,
                    height: 1024,
                },
            },
        }
    };

    //eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
        track(offscreenMap);
        if (!offscreenMap.value) return console.log("no canvas...");
        draw.initOffscreenDimensions(state as GameState, offscreenMap.value);
        draw.offscreenMap(state as GameState, allChunks);
    });

    return (
        <>
            <strong>offscreen map</strong>
            <canvas ref={offscreenMap}></canvas>
        </>
    );
});
