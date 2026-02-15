import {
    NoSerialize,
    Signal,
    useComputed$,
    useVisibleTask$,
} from "@builder.io/qwik";
import { initFpsTest } from "~/components/canvas1/utils";
import { dispatch } from "./useWebSocket";
import draw from "~/services/draw";
import { GameState } from "~/hooks/useState";

const stringify = (data: Record<any, any>) =>
    JSON.stringify(
        Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])),
    );

export default function useRenderLoop(
    ws: Signal<NoSerialize<WebSocket>>,
    state: GameState,
) {
    const isSnapshotChanged$ = useComputed$(() => {
        if (!state.ctx.client.player) return false;
        if (!state.ctx.client.lastSnapshot) return true;
        const last = stringify(state.ctx.client.lastSnapshot);
        const current = stringify(state.ctx.client.player);
        return last !== current;
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        const zero = Number(document.timeline.currentTime);
        const countFps = initFpsTest(zero, 1);
        state.ctx.client.timeSinceLastCheckpoint = Date.now();
        console.log("starting main loop:");

        // initialize offscreen canvas of map tiles /// is this needed?? offscreen map?
        function renderMap() {
            console.log("~~ RENDER MAP ~~ EXPECT to happen RARELY");
            const offscreenCanvas = draw.offscreenMap(state.ctx);
            state.refs.offscreenMap.value = offscreenCanvas;
            draw.visibleMap(state);
            draw.helpHint(state);
        }

        let lastFps = "0";
        let lastEma = "0";

        function saveCheckpoint() {
            const now = Date.now();
            const difference = now - state.ctx.client.timeSinceLastCheckpoint;
            if (difference >= 5 * 1000) {
                console.log("fps:", lastFps, "ema:", lastEma);

                state.ctx.client.timeSinceLastCheckpoint += difference;
                dispatch.checkpoint(ws.value!, state.ctx.client.player!, false);
                // TODO: run this on  some sort of "ACK_CHECKPOINT" response??
                // e.g. lastSnapshot.value = response.snapshot to store the actual last-saved snapshot
                state.ctx.client.lastSnapshot = { ...state.ctx.client.player! };
            }
        }

        let wasHelpShowing = state.ctx.show.help;
        let needsRedrawHelp = false;
        function renderHelp() {
            if (state.ctx.show.help) {
                draw.help(state);
            } else {
                draw.closeHelp(state);
            }
        }

        let wasAfkShowing = state.ctx.show.afk;
        let needsRedrawAfk = false;
        function renderAfk() {
            if (state.ctx.show.afk) {
                draw.afk(state);
            } else {
                draw.closeAfk(state);
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
            
            if (state.ctx.world.lastScale !== state.ctx.world.dimensions.scale) {
                draw.clearAll(state);
            }

            // handle popups
            needsRedrawHelp = wasHelpShowing !== state.ctx.show.help;
            if (needsRedrawHelp) {
                renderHelp();
                needsRedrawHelp = false;
                wasHelpShowing = state.ctx.show.help;
            }

            needsRedrawAfk = wasAfkShowing !== state.ctx.show.afk;
            if (needsRedrawAfk) {
                console.log("redrawing AFK!");
                renderAfk();
                needsRedrawAfk = false;
                wasAfkShowing = state.ctx.show.afk;
            }

            // handle rendering
            draw.fps(state, lastFps, lastEma);
            draw.statusbar(state);
            if (state.ctx.show.devStats) {
                draw.devStats(state);
            } else {
                draw.closeDevStats(state);
            }


            if (state.ctx.client.isDirty.objects) {
                state.ctx.client.isDirty.objects = false;
                draw.objects(state);
            }

            if (state.ctx.client.isDirty.players) {
                state.ctx.client.isDirty.players = false;
                draw.players(state);
            }

            if (state.ctx.client.isDirty.map) {
                state.ctx.client.isDirty.map = false;
                renderMap();
            }

            state.ctx.world.lastScale = state.ctx.world.dimensions.scale;

            // handle checkpoints
            if (state.ctx.client.player && isSnapshotChanged$.value)
                saveCheckpoint();
        })(zero);
    });
}


