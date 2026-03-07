import { useComputed$, useVisibleTask$ } from "@builder.io/qwik";
import { initFpsTest } from "~/components/canvas1/utils";
import draw from "~/services/draw";
import { GameState } from "~/hooks/useState";
import useDispatch$ from "./useDispatch";
import { isSnapshotSame } from "~/simulation/shared/helpers";
import checkpointService from "~/server/checkpointService";

export default function useRenderLoop(
    dispatch$: ReturnType<typeof useDispatch$>,
    state: GameState,
) {
    /**
     * lastSnapshot represents the last snapshot sent/received from the server
     * we check if player has changed from that snapshot to know if we need to dispatch another
     * */
    const isSnapshotChanged$ = useComputed$(() => {
        if (!state.ctx.client.player) return false;
        if (!state.ctx.client.lastAckCheckpoint) return true;
        const playerCheckpoint = checkpointService.fromPlayer(
            state.ctx.client.player,
            state.ctx.client.lastAckCheckpoint.lastSeenAt,
        );
        const isSame = isSnapshotSame(
            playerCheckpoint,
            state.ctx.client.lastAckCheckpoint,
        );
        console.log("~~ comparing snapshots...", {
            playerCheckpoint,
            lastAckCheckpoint: state.ctx.client.lastAckCheckpoint,
            isSame,
        });
        return !isSame;
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
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
            if (!state.ctx.show.helpHint) return;
            draw.helpHint(state);
        }

        let lastFps = "0";
        let lastEma = "0";

        const CHECKPOINT_INTERVAL = 5 * 1000;
        function saveCheckpoint() {
            const now = Date.now();
            const difference = now - state.ctx.client.timeSinceLastCheckpoint;
            if (difference < CHECKPOINT_INTERVAL) return;
            state.ctx.client.timeSinceLastCheckpoint += difference;

            if (isSnapshotChanged$.value) {
                dispatch$.checkpoint(state.ctx.client.player!, false);
                console.log("fps:", lastFps, "ema:", lastEma);
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

        let isCancelled = false;
        // main client loop
        (function loop(ts: number) {
            if (isCancelled) return console.log("~~ loop cancelled");
            requestAnimationFrame(loop);
            const result = countFps(ts);
            if (result) {
                lastFps = result.fps;
                lastEma = result.ema;
            }

            if (
                state.ctx.world.config.lastScale !==
                state.ctx.world.config.scale
            ) {
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

            if (state.ctx.client.isDirty.map) renderMap();
            if (state.ctx.client.isDirty.objects) draw.objects(state);
            if (state.ctx.client.isDirty.players) draw.players(state);

            state.ctx.client.isDirty.objects = false;
            state.ctx.client.isDirty.players = false;
            state.ctx.client.isDirty.map = false;


            state.ctx.world.lastScale = state.ctx.world.dimensions.scale;

            // handle checkpoints
            if (!state.ctx.client.player) return;
            saveCheckpoint();
        })(zero);

        cleanup(() => {
            isCancelled = true;
            console.log("turning off loop...");
        });
    });
}


