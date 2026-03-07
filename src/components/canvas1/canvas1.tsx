import { component$, useSignal, $, NoSerialize } from "@builder.io/qwik";
import {
    ServerMessage,
    ServerOtherPlayerMessage,
    ServerAckRejectionMessage,
    ServerAckCorrectionMessage,
} from "~/types/wss/server";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/hooks/useVimFSM";
import { useNavigate } from "@builder.io/qwik-city";
import { applyActionToWorld } from "~/simulation/client/actions";
import ChooseUsername from "../choose-username/choose-username";
import useWebSocket from "~/hooks/useWebSocket";
import Menu from "../menu/menu";
import useRenderLoop from "~/hooks/useRenderLoop";
import { World } from "~/server/types";
import useState from "../../hooks/useState";
import useDispatch$ from "~/hooks/useDispatch";

type Canvas1Props = {
    worldState: World;
};
const Canvas1 = component$<Canvas1Props>(({ worldState }) => {
    const isReady = useSignal(false);
    const nav = useNavigate();
    const ws = useSignal<NoSerialize<WebSocket>>(undefined);
    const dispatch$ = useDispatch$(ws);

    const getNextSeq = useSeq(); // action index
    const state = useState(worldState, isReady, dispatch$);

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


    const onMessage$ = $((event: MessageEvent<string>) => {
        // console.log("onMessage data:", event.data);
        const data = JSON.parse(event.data) as ServerMessage;
        console.log("onMessage:", data);

        switch (data.type) {
            case "CLOSE":
                if (data.subtype === "START") {
                    console.assert(state.ctx.client.player, 'Expected player on CLOSE_START!!');
                    if (!state.ctx.client.player) break;

                    dispatch$.checkpoint(state.ctx.client.player, true);
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
                if (
                    (data as ServerAckRejectionMessage)?.subtype === "REJECTION"
                )
                    console.log(
                        "REJECTION:",
                        (data as ServerAckRejectionMessage).reason,
                    );
                if (
                    (data as ServerAckCorrectionMessage)?.subtype ===
                    "CORRECTION"
                )
                    console.log(
                        "CORRECTION:",
                        (data as ServerAckCorrectionMessage).reason,
                    );
                state.ctx.onServerAck(data);
                break;
            case "PLAYER":
                if (data.subtype === "MOVE") {
                    state.ctx.onOtherPlayerMove(
                        data as ServerOtherPlayerMessage<"MOVE">,
                    );
                }
                break;
            case "INIT":
                // confirm that playerId has been saved on server
                state.ctx.onInitConfirm(data);
                break;

            default:
                console.warn("INVALID MESSAGE TYPE RECEIVED from server::", data);
        }
    });

    const onConnect$ = $(() => {
        state.ctx.client.isDirty.players = true;
        console.assert(
            !!state.ctx.client.player,
            "EXPECTED PLAYER ON INIT",
            state.ctx.client.player,
        );

        dispatch$.init(state.ctx.client.player!.id);
    });

    useWebSocket(isReady, onMessage$, onConnect$, ws);

    useVimFSM(
        $(async (action) => {
            const seq = await getNextSeq();
            // Send to server; wipe local and server AFK state
            dispatch$.action(seq, action);
            state.ctx.show.afk = false;
            state.ctx.client.afkStartTime = -1;
            state.ctx.client.idleStartTime = Date.now();

            console.log("onAction:", {
                snapshotBefore: { ...state.ctx.client.player, pos: {...state.ctx.client.player?.pos} },
                action,
                seq,
            });

            if (state.ctx.physics.prediction) {
                // Add to prediction buffer for corrected replay
                const snapshotBefore = { ...state.ctx.client.player! };
                state.ctx.client.predictionBuffer.push({
                    seq,
                    action,
                    snapshotBefore,
                });
                // state.ctx.client.lastSnapshot = snapshotBefore;
            }

            // Apply local prediction or command
            const isDirty = await applyActionToWorld(state.ctx, action);
            await state.ctx.updateIsDirty(isDirty);
            console.log(
                "afterAction:",
                { ...state.ctx.client.player, pos: {...state.ctx.client.player?.pos} },
                { ...state.ctx.client.isDirty },
            );
        }),
        isReady,
        state.ctx,
    );

    useRenderLoop(dispatch$, state);

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
                <Menu state={state.ctx} />
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
