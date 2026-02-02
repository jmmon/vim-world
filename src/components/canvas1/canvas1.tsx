import {
    component$,
    useSignal,
    $,
    useVisibleTask$,
    NoSerialize,
} from "@builder.io/qwik";
import {
    ServerAckMessage,
    ServerMessage,
    ServerOtherPlayerMessage,
    ServerAckType,
    ServerInitConfirmMessage,
} from "~/types/messageTypes";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/hooks/useVimFSM";
import { InitializeClientData } from "./types";
import { useNavigate } from "@builder.io/qwik-city";
import { applyActionToWorld } from "~/simulation/client/actions";
import { ClientPhysicsMode, clientPhysicsMode } from "./constants";
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

    const state = useState(worldState);
    const ws = useSignal<NoSerialize<WebSocket>>(undefined);
    const dispatch = useDispatch(ws);

    const getNextSeq = useSeq(); // action index

    console.log("canvas1 component init: players:", state.ctx.world.players);

    const lastInit = useSignal(0);
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async ({ track }) => {
        const selfData = track(initializeSelfData);
        if (!selfData) return;

        const success = await state.ctx.initClientData(selfData);
        if (!success)
            return console.error("error initializing self!", selfData);
        state.ctx.client.isDirty.players = true;

        const now = Date.now();

        console.assert(
            now - lastInit.value > 5000,
            "!!initializing called many times!!",
        );
        console.log(
            "initialized localWorld with client data, NOW READY::",
            selfData,
        );

        lastInit.value = now;
        initializeSelfData.value = undefined; // reset in case we need to fetch again
        isReady.value = true;
    });

    // could also use regular Dialog components for popups and menus, instead of drawing everything on the canvas
    // e.g. afk notice

    const onServerAck$ = $(async (msg: ServerAckMessage<ServerAckType>) => {
        const predictionArr = [...state.ctx.client.predictionBuffer];
        // console.log({
        //     predictionArr: [...predictionArr],
        //     msg: { ...msg },
        //     isPlayersDirty: state.ctx.client.isDirty.players,
        // });
        const index = predictionArr.findIndex((p) => p.seq === msg.seq);
        if (index === -1) return;
        // console.log("found prediction by sequence:", {
        //     predictionArr: [...predictionArr],
        //     index,
        // });

        // NOTE: skip if results of the changes matched: for full prediction on the client
        // - if no client visual prediction, then the resultState and authState would NOT match since client would be behind
        // in case server sends authState while accepted === true
        const resultState =
            predictionArr[predictionArr.findIndex((p) => p.seq === msg.seq + 1)]
                ?.snapshotBefore || state.ctx.client.player;
        if (
            msg.authoritativeState?.pos &&
            resultState.pos.x === msg.authoritativeState.pos.x &&
            resultState.pos.y === msg.authoritativeState.pos.y &&
            msg.authoritativeState.dir &&
            resultState.dir === msg.authoritativeState.dir
        ) {
            // results at that point in time matched:
            // still remove prediction at index from buffer,
            predictionArr.splice(index, 1);
            // do I want to clear everything before it as well?
            // predictionArr.splice(0, index + 1);
            state.ctx.client.predictionBuffer = predictionArr;
            // console.log("~~ results are same: remaining predictions:", {
            //     remaining: [...predictionArr],
            //     index,
            //     resultState: { ...resultState },
            // });
            return;
            // no need to replay anything
        }

        // Prediction matched — just drop it
        if (!msg.authoritativeState) {
            // console.log("~~ no authoritative state, do nothing", {
            //     predictionArr: [...predictionArr],
            //     index,
            // });
            predictionArr.splice(index, 1);
            state.ctx.client.predictionBuffer = predictionArr;
            return;
        }

        // 1. Roll back to authoritative position
        // roll back to corrected position for that msg
        state.ctx.client.player = {
            ...state.ctx.client.player!,
            ...msg.authoritativeState,
            pos: {
                ...state.ctx.client.player!.pos,
                ...msg.authoritativeState.pos,
            },
        };
        console.log("EXPECT POSITION DIFFERENCE::", {
            lastSnapshot: { ...state.ctx.client.lastSnapshot },
            currentPlayer: { ...state.ctx.client.player },
        });
        state.ctx.client.lastSnapshot = { ...state.ctx.client.player! };

        // 2. Remove confirmed actions up through index
        predictionArr.splice(0, index + 1);

        state.ctx.client.predictionBuffer = predictionArr;
        state.ctx.client.isDirty.players = true;

        if (clientPhysicsMode === ClientPhysicsMode.NONE) return;

        console.log("~~ predictionBuffer replaying:", [...predictionArr]);

        const resultDirty = {
            players: false,
            objects: false,
            map: false,
        };
        // 3. Replay remaining predictions based on the corrected position
        for (const p of predictionArr) {
            const result = await applyActionToWorld(state.ctx, p.action, {
                collision:
                    clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
            });
            if (!result) continue;

            if (result.players) resultDirty.players = true;
            if (result.objects) resultDirty.objects = true;
            if (result.map) resultDirty.map = true;
        }
        // snapshot is current visual state of client
        state.ctx.client.lastSnapshot = { ...state.ctx.client.player! };
        Object.entries(resultDirty).forEach(([k, isDirty]) => {
            if (!isDirty) return;
            state.ctx.client.isDirty[
                k as keyof typeof state.ctx.client.isDirty
            ] = true;
        });
    });

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
                if (data?.subtype === "REJECTION")
                    console.log("REJECTION:", data.reason);
                if (data?.subtype === "CORRECTION")
                    console.log("CORRECTION:", data.reason);
                // state.ctx.onServerAck(data);
                onServerAck$(data);
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
            const result = await applyActionToWorld(state.ctx, action, {
                collision:
                    clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                prediction: clientPhysicsMode !== ClientPhysicsMode.NONE,
            });
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
    );

    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    useRenderLoop(ws, state);

    const dimensions = state.ctx.world.dimensions;
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
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={state.refs.objects}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={state.refs.players}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={state.refs.overlay}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <ChooseUsername initializeSelfData={initializeSelfData} />
            <Menu state={state.ctx} />
        </div>
    );
});

export default Canvas1;
