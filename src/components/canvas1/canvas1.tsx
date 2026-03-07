import {
    component$,
    useSignal,
    $,
    NoSerialize,
    CSSProperties,
} from "@builder.io/qwik";
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
            // 1. Add to prediction buffer // for serverAck to replay if needed
            const snapshotBefore = { ...state.ctx.client.player! };
            state.ctx.client.predictionBuffer.push({
                seq,
                action,
                snapshotBefore,
            });
            state.ctx.client.lastSnapshot = snapshotBefore;
            console.log("onAction:", { snapshotBefore, action, seq });

            // 2. Apply local prediction
            const isDirty = await applyActionToWorld(state.ctx, action);
            state.ctx.client.isDirty = {
                ...state.ctx.client.isDirty,
                ...isDirty
            };
            console.log("afterAction:", { ...state.ctx.client.player });

            // Send to server; wipe local and server AFK state
            dispatch$.action(seq, action);
            state.ctx.show.afk = false;
            state.ctx.client.afkStartTime = -1;
            state.ctx.client.idleStartTime = Date.now();
        }),
        isReady,
        state.ctx,
    );

    useRenderLoop(dispatch$, state);

    const dimensions = state.ctx.world.dimensions;
    const canvasStyle: CSSProperties = { position: "absolute", top: 0, left: 0, imageRendering: "pixelated" };
    return (
        <div
            style={{
                position: "relative",
                width: dimensions.viewportWidthPx + "px",
                height: dimensions.viewportHeightPx + "px",
            }}
        >
            <canvas
                ref={state.refs.map}
                width={dimensions.viewportWidthPx}
                height={dimensions.viewportHeightPx}
                style={canvasStyle}
                data-name="map"
            />
            <canvas
                ref={state.refs.objects}
                width={dimensions.viewportWidthPx}
                height={dimensions.viewportHeightPx}
                style={canvasStyle}
                data-name="objects"
            />
            <canvas
                ref={state.refs.players}
                width={dimensions.viewportWidthPx}
                height={dimensions.viewportHeightPx}
                style={canvasStyle}
                data-name="players"
            />
            <canvas
                ref={state.refs.overlay}
                width={dimensions.viewportWidthPx}
                height={dimensions.viewportHeightPx}
                style={canvasStyle}
                data-name="overlay"
            />
            <ChooseUsername initializeSelfData={initializeSelfData} />
            <Menu state={state.ctx} />
        </div>
    );
});

export default Canvas1;
