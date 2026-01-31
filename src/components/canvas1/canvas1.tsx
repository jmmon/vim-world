import {
    component$,
    useSignal,
    $,
    useVisibleTask$,
    NoSerialize,
    useStore,
} from "@builder.io/qwik";
import {
    ServerAckMessage,
    ServerMessage,
    ServerPlayerMoveMessage,
    ServerAckType,
    ServerInitConfirmMessage,
} from "~/fsm/types";
import useSeq from "../../hooks/useSeq";
import useVimFSM from "~/fsm/useVimFSM";
import {
    InitializeClientData,
    LocalWorldWrapper,
    Player,
    Prediction,
    Vec2,
} from "./types";
import { useNavigate } from "@builder.io/qwik-city";
import { applyActionToWorld } from "~/fsm/actions";
import {
    ClientPhysicsMode,
    clientPhysicsMode,
    getScaledTileSize,
} from "./constants";
import ChooseUsername from "../choose-username/choose-username";
import { isWalkable, isWithinBounds } from "~/fsm/movement";
import useWebSocket, { dispatch } from "~/hooks/useWebSocket";
import Menu from "../menu/menu";
import useRenderLoop from "~/hooks/useRenderLoop";
import { ServerWorld } from "~/server/types";

type Canvas1Props = {
    worldState: ServerWorld;
}
const Canvas1 = component$<Canvas1Props>(({ worldState }) => {
    const isReady = useSignal(false);
    const nav = useNavigate();

    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();
    const isAfk = useSignal(-1);

    const getNextSeq = useSeq(); // action index
    const initializeSelfData = useSignal<InitializeClientData | undefined>(
        undefined,
    );
    const predictionBuffer = useSignal<Prediction[]>([]);
    const isObjectsDirty = useSignal(true);
    const isPlayersDirty = useSignal(true);
    const isMapDirty = useSignal(true);
    const lastSnapshot = useSignal<Player | undefined>(undefined);
    const timeSinceLastCheckpoint = useSignal(Date.now());

    const localWorldWrapper = useStore<LocalWorldWrapper>({
        world: {
            ...worldState,
            lastScale: 0,
        },
        client: {
            player: undefined,
            username: undefined,
            usernameHash: undefined,
            lastProcessedSeq: undefined,
        },
        show: {
            help: false,
            menu: false,
            afk: false,
        },
        isWithinBounds: $(function (this: LocalWorldWrapper, target: Vec2) {
            return isWithinBounds(this.world.map, target);
        }),
        isWalkable: $(function (this: LocalWorldWrapper, target: Vec2) {
            return isWalkable(this.world, target);
        }),
        addPlayer: $(function (this: LocalWorldWrapper, player: Player) {
            if (!player) return false;
            try {
                this.world.players.set(player.id, player);
                console.log("added player:", player);
                return true;
            } catch (err) {
                console.error("addPlayer error:", err);
                return false;
            }
        }),
        initClientData: $(function (
            this: LocalWorldWrapper,
            data: InitializeClientData,
        ) {
            try {
                lastSnapshot.value = this.client.player;

                this.client.player = data.player;
                this.client.username = data.username;
                this.client.usernameHash = data.usernameHash;
                this.client.lastProcessedSeq = -1;

                console.log("initializeSelf complete!:", data);
                return true;
            } catch (err) {
                console.error("initializeSelf error:", err);
                return false;
            }
        }),
        getScaledTileSize: $(function (this: LocalWorldWrapper, scale: number) {
            return getScaledTileSize(scale);
        }),
        rerender: $(function (this: LocalWorldWrapper) {
            isMapDirty.value = true;
            isObjectsDirty.value = true;
            isPlayersDirty.value = true;
        }),
    });

    console.log(
        "canvas1 component init: players:",
        localWorldWrapper.world.players,
    );


    const lastInit = useSignal(0);
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async ({ track }) => {
        const selfData = track(initializeSelfData);
        if (!selfData) return;

        const success = await localWorldWrapper.initClientData(selfData);
        if (!success)
            return console.error("error initializing self!", selfData);
        isPlayersDirty.value = true;

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

    const clearPredictedMovesUpTo = $(
        (predictionArr: Prediction[], index: number) => {
            predictionArr.splice(0, index + 1);
        },
    );

    const onServerAck$ = $((msg: ServerAckMessage<ServerAckType>) => {
        const predictionArr = [...predictionBuffer.value];
        // console.log({ predictionArr, msg, isDirty: hasDirtyPlayers.value });
        const index = predictionArr.findIndex((p) => p.seq === msg.seq);
        if (index === -1) return;

        // Prediction matched — just drop it
        if (!msg.authoritativeState) {
            predictionArr.splice(index, 1);
            predictionBuffer.value = predictionArr;
            return;
        }

        // 1. Roll back to authoritative position
        // roll back to corrected position for that msg

        lastSnapshot.value = localWorldWrapper.client.player;
        localWorldWrapper.client.player = {
            ...localWorldWrapper.client.player!,
            ...msg.authoritativeState,
        };

        // 2. Remove confirmed actions up through index
        clearPredictedMovesUpTo(predictionArr, index);

        predictionBuffer.value = predictionArr;
        isPlayersDirty.value = true;

        if (clientPhysicsMode === ClientPhysicsMode.NONE) return;

        console.log("predictionBuffer remaining:", predictionArr);

        // 3. Replay remaining predictions based on the corrected position
        for (const p of predictionArr) {
            applyActionToWorld(localWorldWrapper, p.action, {
                collision:
                    clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
            });
        }
    });

    const onOtherPlayerMove$ = $((data: ServerPlayerMoveMessage) => {
        // skip self
        if (
            !data.playerId ||
            data.playerId === localWorldWrapper.client.player?.id
        ) {
            return;
        }

        // e.g. updating from other clients: find the moving player and move it
        const otherPlayer = localWorldWrapper.world.players.get(data.playerId);
        if (!otherPlayer) return;

        otherPlayer.pos = data.pos;
        otherPlayer.dir = data.dir;

        isPlayersDirty.value = true;
    });

    const onInitConfirm$ = $((data: ServerInitConfirmMessage) => {
        console.log("RECEIVED INIT CONFIRM:", { data });
        console.assert(
            localStorage.getItem("playerId") === data.playerId,
            "!! playerId mismatch!!",
        );
    });

    const onMessage$ = $(
        (ws: NoSerialize<WebSocket>, event: MessageEvent<string>) => {
            // console.log("onMessage data:", event.data);
            const data = JSON.parse(event.data) as ServerMessage;
            console.assert(!!ws, "!!websocket not open!! in onMessage$");

            switch (data.type) {
                case "CLOSE_START":
                    if (!localWorldWrapper.client.player) break;

                    dispatch.checkpoint(
                        ws,
                        localWorldWrapper.client.player,
                        true,
                    );
                    timeSinceLastCheckpoint.value = Date.now();
                    break;
                case "TERMINATE":
                case "CLOSE":
                    nav("/");
                    break;
                case "AFK":
                    isAfk.value = Date.now();
                    break;
                case "ACK":
                case "CORRECTION":
                case "REJECTION":
                    onServerAck$(data);
                    break;
                case "PLAYER_MOVE":
                    onOtherPlayerMove$(data);
                    break;
                case "INIT_CONFIRM":
                    // confirm that playerId has been saved on server
                    onInitConfirm$(data);
                    break;

                default:
                    console.warn("INVALID MESSAGE TYPE RECEIVED:", data);
            }
        },
    );

    const onConnect$ = $((ws: NoSerialize<WebSocket>) => {
        isPlayersDirty.value = true;
        console.assert(
            !!localWorldWrapper.client.player,
            "EXPECTED PLAYER ON INIT",
            localWorldWrapper.client.player,
        );

        dispatch.init(ws, localWorldWrapper.client.player!.id);

        // would prefer to do it on /api/player post req, but don't have the clientId yet
        //
        // maybe post API should create a new client without a websocket, in a temp UUID,
        // would have to send back to client so client could pass into the init??
        // on websocket connect, can't do anything because we don't have the playerId,
        // on INIT message, would have to get the tempId from clients and move it to a new ID??
        // delete and set
    });

    const ws = useWebSocket(isReady, onMessage$, onConnect$);

    /** =======================================================
     *          keyboard actions; apply to world
     * ======================================================= */
    useVimFSM(
        $(async (action) => {
            const seq = await getNextSeq();
            // 1. Add to prediction buffer // for serverAck to replay if needed
            predictionBuffer.value.push({
                seq,
                action,
                snapshotBefore: { ...localWorldWrapper.client.player! },
            });
            lastSnapshot.value = localWorldWrapper.client.player;

            // 2. Apply local prediction
            // console.log('APPLYING ACTION:', {action, localWorldWrapper});
            const result = await applyActionToWorld(localWorldWrapper, action, {
                collision:
                    clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                prediction: clientPhysicsMode !== ClientPhysicsMode.NONE,
            });
            // console.log('applyAction result:', result);
            if (result) isPlayersDirty.value = true;

            // 3. Send to server; wipe local and server AFK state
            dispatch.action(ws.value, seq, action);
            localWorldWrapper.show.afk = false;
            isAfk.value = -1;
        }),
        isReady,
    );

    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    useRenderLoop(
        ws,
        localWorldWrapper,
        overlayRef,
        mapRef,
        objectsRef,
        playersRef,
        timeSinceLastCheckpoint,
        isMapDirty,
        isPlayersDirty,
        isObjectsDirty,
        lastSnapshot,
    );

    const dimensions = localWorldWrapper.world.dimensions;
    return (
        <div
            style={{
                position: "relative",
                width: dimensions.canvasWidth + "px",
                height: dimensions.canvasHeight + "px",
            }}
        >
            <canvas
                ref={mapRef}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={objectsRef}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={playersRef}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={overlayRef}
                width={dimensions.canvasWidth}
                height={dimensions.canvasHeight}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <ChooseUsername initializeSelfData={initializeSelfData} />
            <Menu state={localWorldWrapper} />
        </div>
    );
});

export default Canvas1;
