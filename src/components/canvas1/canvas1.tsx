import { component$, useSignal, $, NoSerialize } from "@builder.io/qwik";
import { ServerMessage, ServerOtherPlayerMessage } from "~/types/wss/server";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/hooks/useVimFSM";
import { useNavigate } from "@builder.io/qwik-city";
// import { applyActionToWorld } from "~/simulation/client/actions";
import ChooseUsername from "../choose-username/choose-username";
import useWebSocket from "~/hooks/useWebSocket";
import Menu from "../menu/menu";
import useRenderLoop from "~/hooks/useRenderLoop";
import useState, { handlers } from "../../hooks/useState";
import { VimAction } from "~/fsm/types";
import { expandAction } from "~/simulation/shared/loop/helpers";
import { World } from "~/server/types";
import { playerSnapshot } from "~/simulation/shared/helpers";

type Canvas1Props = {
    worldState: World<'Client'>;
};
const Canvas1 = component$<Canvas1Props>(({ worldState }) => {
    const nav = useNavigate();
    const ws = useSignal<NoSerialize<WebSocket>>(undefined);
    const getNextSeq = useSeq(); // action index
    const state = useState(worldState, ws);

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

                    state.ctx.dispatch.checkpoint(state.ctx.client.player, true);
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
                }
                break;
            case "INIT":
                // confirm that playerId has been saved on server
                handlers.onInitConfirm(state.ctx, serverMessage);
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
        console.assert(
            !!state.ctx.client.player,
            "EXPECTED PLAYER ON INIT",
            state.ctx.client.player,
        );

        state.ctx.dispatch.init(state.ctx.client.player!.id);
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
    useVimFSM(
        enqueueAction,
        state.ctx,
    );
    useRenderLoop(state);

    // TODO: adjust width and height as needed based on camera settings
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
                    width={viewport.width}
                    height={viewport.height}
                    data-name="map"
                />
                <canvas
                    ref={state.refs.objects}
                    width={viewport.width}
                    height={viewport.height}
                    data-name="objects"
                />
                <canvas
                    ref={state.refs.players}
                    width={viewport.width}
                    height={viewport.height}
                    data-name="players"
                />
                <canvas
                    ref={state.refs.overlay}
                    width={viewport.width}
                    height={viewport.height}
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
