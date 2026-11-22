import {
    component$,
    useSignal,
    $,
    NoSerialize,
    useVisibleTask$,
} from "@builder.io/qwik";
import {
    ServerMessage,
    ServerOtherPlayerMessage,
    ServerPlayerConnectMessage,
    ServerPlayerDisconnectMessage,
} from "~/types/wss/server";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/hooks/useVimFSM";
import { useNavigate } from "@builder.io/qwik-city";
import ChooseUsername from "../choose-username/choose-username";
import useWebSocket from "~/hooks/useWebSocket";
import Menu from "../menu/menu";
import useRenderLoop from "~/hooks/useRenderLoop";
import useZoneTeaching from "~/hooks/useZoneTeaching";
import useState, { handlers } from "../../hooks/useState";
import { VimAction } from "~/fsm/types";
import { expandAction } from "~/simulation/shared/loop/helpers";
import { World } from "~/server/types";
import { playerSnapshot } from "~/simulation/shared/helpers";

type Canvas1Props = {
    worldState: World<"Client">;
};
const Canvas1 = component$<Canvas1Props>(({ worldState }) => {
    const nav = useNavigate();
    const ws = useSignal<NoSerialize<WebSocket>>(undefined);
    const getNextSeq = useSeq(); // action index
    const state = useState(worldState, ws);

    // dev-only: expose the live ctx so Playwright can assert state values
    // (pos, hints, entity state) instead of pixels. Never ships to prod.
    // must be a task: the component body never re-runs on the client (Qwik
    // resume only executes QRLs), so a plain body statement is SSR-only.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        if (import.meta.env.DEV) (window as any).__vimworld = state.ctx;
    });

    // so when I update cols, it causes component to rerender,
    // I guess because styles are used in the canvases below
    //
    // could update width/height via refs instead of styles
    console.log(
        "canvas1 component init: players:",
        state.ctx.world.players,
        " entities::",
        state.ctx.world.entities,
    );

    const onMessage$ = $(async (event: MessageEvent<string>) => {
        // console.log("onMessage data:", event.data);
        const serverMessage = JSON.parse(event.data) as ServerMessage;
        console.log(
            `onMessage: ${serverMessage.type}${
                "subtype" in serverMessage ? "." + serverMessage?.subtype : ""
            }${
                "reason" in serverMessage ? " - " + serverMessage?.reason : ""
            }:`,
            serverMessage,
        );

        switch (serverMessage.type) {
            case "CLOSE":
                if (serverMessage.subtype === "START") {
                    console.assert(
                        state.ctx.client.player,
                        "Expected player on CLOSE_START!!",
                    );
                    if (!state.ctx.client.player) break;

                    state.ctx.dispatch.checkpoint(
                        state.ctx.client.player,
                        true,
                    );
                    state.ctx.client.timeSinceLastCheckpoint = Date.now();
                    break;
                }
                nav("/");
                break;
            case "AFK":
                state.ctx.client.afkStartTime = Date.now();
                state.ctx.show.afk = true;
                break;
            case "ACK":
                handlers.onServerAck(state.ctx, serverMessage);
                break;
            case "PLAYER":
                if (serverMessage.subtype === "MOVE") {
                    handlers.onOtherPlayerMove(
                        state.ctx,
                        serverMessage as ServerOtherPlayerMessage<"MOVE">,
                    );
                } else if (serverMessage.subtype === "CONNECT") {
                    handlers.onPlayerConnect(
                        state.ctx,
                        serverMessage as ServerPlayerConnectMessage,
                    );
                } else if (serverMessage.subtype === "DISCONNECT") {
                    handlers.onPlayerDisconnect(
                        state.ctx,
                        serverMessage as ServerPlayerDisconnectMessage,
                    );
                }
                break;
            case "INIT":
                // confirm that playerId has been saved on server
                handlers.onInitConfirm(state.ctx, serverMessage);
                break;
            case "WORLD":
                handlers.onWorldState(state.ctx, serverMessage);
                break;

            default:
                console.warn(
                    "INVALID MESSAGE TYPE RECEIVED from server::",
                    serverMessage,
                );
        }
    });

    const onConnect$ = $(() => {
        state.ctx.client.isDirty.players = true;
        // we can be watching the world before we identify ourselves:
        // the server only needs our player id once we are logged in
        if (!state.ctx.client.player) return;
        state.ctx.dispatch.init(state.ctx.client.player.id);
    });

    useWebSocket(state, onMessage$, onConnect$, ws);

    const enqueueAction = $(async (action: VimAction) => {
        const seq = await getNextSeq();
        const now = Date.now();

        // send to server for validation/correction
        if (state.ctx.physics.serverAck) state.ctx.dispatch.action(seq, action);

        // clear afk
        state.ctx.show.afk = false;
        state.ctx.client.afkStartTime = -1;
        state.ctx.client.idleStartTime = now;

        const input = {
            seq,
            action,
            snapshotBefore: playerSnapshot(state.ctx),
        };
        console.log("onAction:", JSON.stringify(input));

        if (state.ctx.physics.prediction) {
            // original actions stored for replay
            state.ctx.client.inputBuffer.push(input);

            // expanded actions for tick-gating
            const expanded = expandAction(
                { action, seq, clientTime: now },
                state.ctx.client.lastProcessedSeq!,
            );
            state.ctx.client.actionQueue.push(...expanded);
        }
    });

    /** =======================================================
     *          keyboard actions; apply to world
     * ======================================================= */
    useVimFSM(enqueueAction, state.ctx);
    useRenderLoop(state);
    // teach the intro beat (move → hop → pick → place) as the player advances
    // through each zone; the render loop redraws the hint panel on change.
    useZoneTeaching(state);

    // The backing store is owned solely by viewport.updateCanvas: if the JSX
    // width/height below read the live viewport, Qwik's DOM patching assigns
    // canvas.width itself on :set columns/lines (component re-renders on the
    // store change), clearing the bitmaps without raising
    // needsOverlayRepaint. useSignal keeps the SSR/hydration values constant
    // across re-renders so Qwik's diff never touches the backing store.
    const initialSize = useSignal({
        width: state.ctx.client.viewport.width,
        height: state.ctx.client.viewport.height,
    });
    const viewport = state.ctx.client.viewport;
    return (
        <>
            <div
                ref={state.refs.container}
                class="view-container"
                style={{
                    position: "relative",
                    width: viewport.width + "px",
                    height: viewport.height + "px",
                }}
            >
                <canvas
                    ref={state.refs.map}
                    width={initialSize.value.width}
                    height={initialSize.value.height}
                    data-name="map"
                />
                <canvas
                    ref={state.refs.objects}
                    width={initialSize.value.width}
                    height={initialSize.value.height}
                    data-name="objects"
                />
                <canvas
                    ref={state.refs.players}
                    width={initialSize.value.width}
                    height={initialSize.value.height}
                    data-name="players"
                />
                <canvas
                    ref={state.refs.overlay}
                    width={initialSize.value.width}
                    height={initialSize.value.height}
                    data-name="overlay"
                />
                <ChooseUsername state={state.ctx} />
                <Menu ctx={state.ctx} />
            </div>
            <nav>
                <a href="/test/offscreen-map">offscreen map</a>
            </nav>
        </>
    );

    // return (
    //     <>
    //         <div
    //             ref={state.refs.container}
    //             class="view-container"
    //         >
    //             <canvas
    //                 ref={state.refs.map}
    //                 data-name="map"
    //             />
    //             <canvas
    //                 ref={state.refs.objects}
    //                 data-name="objects"
    //             />
    //             <canvas
    //                 ref={state.refs.players}
    //                 data-name="players"
    //             />
    //             <canvas
    //                 ref={state.refs.overlay}
    //                 data-name="overlay"
    //             />
    //             <ChooseUsername state={state.ctx} />
    //             <Menu state={state.ctx} />
    //         </div>
    //         <nav>
    //             <a href="/test/offscreen-map">offscreen map</a>
    //         </nav>
    //     </>
    // );
});

export default Canvas1;
