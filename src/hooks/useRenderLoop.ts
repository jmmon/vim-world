import {
    NoSerialize,
    Signal,
    useComputed$,
    useSignal,
    useVisibleTask$,
} from "@builder.io/qwik";
import { LocalWorldWrapper, Player } from "~/components/canvas1/types";
import { initFpsTest } from "~/components/canvas1/utils";
import { dispatch } from "./useWebSocket";
import draw from "~/services/draw";

const stringify = (data: Record<any, any>) =>
    JSON.stringify(
        Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])),
    );

export default function useRenderLoop(
    ws: Signal<NoSerialize<WebSocket>>,
    localWorldWrapper: LocalWorldWrapper,
    overlayRef: Signal<HTMLCanvasElement | undefined>,
    mapRef: Signal<HTMLCanvasElement | undefined>,
    objectsRef: Signal<HTMLCanvasElement | undefined>,
    playersRef: Signal<HTMLCanvasElement | undefined>,
    timeSinceLastCheckpoint: Signal<number>,
    isMapDirty: Signal<boolean>,
    isPlayersDirty: Signal<boolean>,
    isObjectsDirty: Signal<boolean>,
    lastSnapshot: Signal<Player | undefined>,
) {
    const offscreenMap = useSignal<HTMLCanvasElement>();

    const isSnapshotChanged$ = useComputed$(() => {
        if (!localWorldWrapper.client.player) return false;
        if (!lastSnapshot.value) return true;
        const last = stringify(lastSnapshot.value);
        const current = stringify(localWorldWrapper.client.player);
        return last !== current;
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        const zero = Number(document.timeline.currentTime);
        const countFps = initFpsTest(zero);
        timeSinceLastCheckpoint.value = Date.now();
        console.log("starting main loop:");

        // initialize offscreen canvas of map tiles /// is this needed?? offscreen map?
        function renderMap() {
            console.log("~~ RENDER MAP ~~ EXPECT to happen RARELY");
            const offscreenCanvas = draw.offscreenMap(localWorldWrapper);
            offscreenMap.value = offscreenCanvas;
            draw.visibleMap(localWorldWrapper, mapRef.value!, offscreenCanvas);
            draw.helpHint(
                localWorldWrapper,
                overlayRef.value!.getContext("2d")!,
            );
        }

        let lastFps = 0;
        let lastEma = 0;

        function saveCheckpoint() {
            const now = Date.now();
            const difference = now - timeSinceLastCheckpoint.value;
            if (difference >= 5 * 1000) {
                console.log("fps:", lastFps, "ema:", lastEma);

                timeSinceLastCheckpoint.value += difference;
                dispatch.checkpoint(
                    ws.value!,
                    localWorldWrapper.client.player!,
                    false,
                );
                // TODO: run this on  some sort of "ACK_CHECKPOINT" response??
                // e.g. lastSnapshot.value = response.snapshot to store the actual last-saved snapshot
                lastSnapshot.value = localWorldWrapper.client.player;
            }
        }

        let isHelpShowing = localWorldWrapper.show.help;
        let needsRedrawHelp = false;
        function renderHelp() {
            if (isHelpShowing) {
                draw.closeHelp(
                    localWorldWrapper,
                    overlayRef.value!.getContext("2d")!,
                );
            } else {
                draw.help(
                    localWorldWrapper,
                    overlayRef.value!.getContext("2d")!,
                );
            }
        }

        let isAfkShowing = localWorldWrapper.show.afk;
        let needsRedrawAfk = false;
        function renderAfk() {
            if (isAfkShowing) {
                draw.afk(
                    localWorldWrapper,
                    overlayRef.value!.getContext("2d")!,
                );
            } else {
                draw.closeAfk(
                    localWorldWrapper,
                    overlayRef.value!.getContext("2d")!,
                );
            }
        }

        // main client loop
        (function loop(ts: number) {
            requestAnimationFrame(loop);
            const result = countFps(ts);
            if (result) {
                lastFps = result.fps;
                lastEma = result.ema;
            }

            // handle popups
            needsRedrawHelp = isHelpShowing !== localWorldWrapper.show.help;
            if (needsRedrawHelp) {
                renderHelp();
                needsRedrawHelp = false;
                isHelpShowing = localWorldWrapper.show.help;
            }

            needsRedrawAfk = isAfkShowing !== localWorldWrapper.show.afk;
            if (needsRedrawAfk) {
                renderAfk();
                needsRedrawAfk = false;
                isAfkShowing = localWorldWrapper.show.afk;
            }

            // handle rendering
            draw.fps(
                localWorldWrapper,
                overlayRef.value!,
                String(lastFps),
                String(lastEma),
            );

            if (isMapDirty.value) {
                isMapDirty.value = false;
                renderMap();
            }

            if (isObjectsDirty.value) {
                isObjectsDirty.value = false;
                draw.objects(localWorldWrapper, objectsRef.value!);
            }

            if (isPlayersDirty.value) {
                isPlayersDirty.value = false;
                draw.players(localWorldWrapper, playersRef.value!);
            }

            localWorldWrapper.world.lastScale =
                localWorldWrapper.world.dimensions.scale;

            // handle checkpoints
            if (localWorldWrapper.client.player && isSnapshotChanged$.value)
                saveCheckpoint();
        })(zero);
    });
}
