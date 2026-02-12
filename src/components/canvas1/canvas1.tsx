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
    ServerInitConfirmMessage,
    ServerAckRejectionMessage,
    ServerAckCorrectionMessage,
} from "~/types/messageTypes";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/hooks/useVimFSM";
import { InitializeClientData } from "./types";
import { useNavigate } from "@builder.io/qwik-city";
import { applyActionToWorld } from "~/simulation/client/actions";
import ChooseUsername from "../choose-username/choose-username";
import useWebSocket from "~/hooks/useWebSocket";
import Menu from "../menu/menu";
import useRenderLoop from "~/hooks/useRenderLoop";
import { ServerWorld } from "~/server/types";
import useState from "../../hooks/useState";
import useDispatch from "~/hooks/useDispatch";

type Canvas1Props = {
    worldState: ServerWorld;
};
const Canvas1 = component$<Canvas1Props>(({ worldState }) => {
    const isReady = useSignal(false);
    const initializeSelfData = useSignal<InitializeClientData>();
    const nav = useNavigate();
    const ws = useSignal<NoSerialize<WebSocket>>(undefined);
    const dispatch = useDispatch(ws);

    const getNextSeq = useSeq(); // action index
    const state = useState(worldState, isReady, initializeSelfData);

    console.log("canvas1 component init: players:", state.ctx.world.players, ' entities::', state.ctx.world.entities);

    const onOtherPlayerMove$ = $((data: ServerOtherPlayerMessage<"MOVE">) => {
        // skip self
        if (!data.playerId || data.playerId === state.ctx.client.player?.id) {
            return;
        }

        // e.g. updating from other clients: find the moving player and move it
        const otherPlayer = state.ctx.world.players.get(data.playerId);
        if (!otherPlayer) return;

        otherPlayer.pos = data.pos;
        otherPlayer.dir = data.dir;

        state.ctx.client.isDirty.players = true;
    });

    const onInitConfirm$ = $((data: ServerInitConfirmMessage) => {
        console.log("RECEIVED INIT CONFIRM:", { data });
        console.assert(
            localStorage.getItem("playerId") === data.playerId,
            "!! playerId mismatch!!",
        );
    });

    const onMessage$ = $((event: MessageEvent<string>) => {
        // console.log("onMessage data:", event.data);
        const data = JSON.parse(event.data) as ServerMessage;
        console.log("onMessage:", data);

        switch (data.type) {
            case "CLOSE":
                if (data.subtype === "START") {
                    if (!state.ctx.client.player) break;

                    dispatch.checkpoint(state.ctx.client.player, true);
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
                if ((data as ServerAckRejectionMessage)?.subtype === "REJECTION")
                    console.log("REJECTION:", (data as ServerAckRejectionMessage).reason);
                if ((data as ServerAckCorrectionMessage)?.subtype === "CORRECTION")
                    console.log("CORRECTION:", (data as ServerAckCorrectionMessage).reason);
                state.ctx.onServerAck(data);
                break;
            case "PLAYER":
                if (data.subtype === "MOVE") {
                    onOtherPlayerMove$(
                        data as ServerOtherPlayerMessage<"MOVE">,
                    );
                }
                break;
            case "INIT":
                console.assert(
                    data.subtype === "CONFIRM",
                    'EXPECTED subtype "CONFIRM", got',
                    data.subtype,
                );
                // confirm that playerId has been saved on server
                onInitConfirm$(data);
                break;

            default:
                console.warn("INVALID MESSAGE TYPE RECEIVED:", data);
        }
    });

    const onConnect$ = $(() => {
        state.ctx.client.isDirty.players = true;
        console.assert(
            !!state.ctx.client.player,
            "EXPECTED PLAYER ON INIT",
            state.ctx.client.player,
        );

        dispatch.init(state.ctx.client.player!.id);

        // would prefer to do it on /api/player post req, but don't have the clientId yet
        //
        // maybe post API should create a new client without a websocket, in a temp UUID,
        // would have to send back to client so client could pass into the init??
        // on websocket connect, can't do anything because we don't have the playerId,
        // on INIT message, would have to get the tempId from clients and move it to a new ID??
        // delete and set
    });

    useWebSocket(isReady, onMessage$, onConnect$, ws);

    /** =======================================================
     *          keyboard actions; apply to world
     * ======================================================= */
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
            // console.log('APPLYING ACTION:', {action, localWorldWrapper});
            const result = await applyActionToWorld(state.ctx, action);
            // console.log('applyAction result:', result);
            Object.entries(result).forEach(([k, isDirty]) => {
                if (!isDirty) return;
                state.ctx.client.isDirty[
                    k as keyof typeof state.ctx.client.isDirty
                ] = true;
            });
            console.log("afterAction:", { ...state.ctx.client.player });

            // 3. Send to server; wipe local and server AFK state
            dispatch.action(seq, action);
            state.ctx.show.afk = false;
            state.ctx.client.afkStartTime = -1;
            state.ctx.client.idleStartTime = Date.now();
        }),
        isReady,
        state.ctx,
    );

    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    useRenderLoop(ws, state);

    const dimensions = state.ctx.world.dimensions;
    const canvasStyle: CSSProperties = { position: "absolute", top: 0, left: 0, imageRendering: "pixelated" };
    return (
        <div
            style={{
                position: "relative",
                width: dimensions.canvasWidth + "px",
                height: dimensions.canvasHeight + "px",
            }}
        >
            <canvas
                ref={state.refs.map}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={canvasStyle}
                data-name="map"
            />
            <canvas
                ref={state.refs.objects}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={canvasStyle}
                data-name="objects"
            />
            <canvas
                ref={state.refs.players}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={canvasStyle}
                data-name="players"
            />
            <canvas
                ref={state.refs.overlay}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={canvasStyle}
                data-name="overlay"
            />
            <ChooseUsername initializeSelfData={initializeSelfData} />
            <Menu state={state.ctx} />
        </div>
    );
});

export default Canvas1;
