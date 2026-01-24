import {
    component$,
    useSignal,
    $,
    useVisibleTask$,
    NoSerialize,
} from "@builder.io/qwik";
import useWebSocket from "./useWebSocket";
import {
    ServerAckMessage,
    Prediction,
    ServerMessage,
    ServerPlayerMoveMessage,
    ServerLoadCheckpointMessage,
    ServerAckType,
} from "~/fsm/types";
import draw from "./draw";
import useSeq from "./useSeq";
import useVimFSM from "~/fsm/useVimFSM";
import { initFpsCounter } from "./utils";
import { Player, World } from "./types";
import { useNavigate } from "@builder.io/qwik-city";
import { dispatchActionToServer, applyActionToWorld, applyCheckpointToServer, onInit } from "~/fsm/actions";
import { ClientPhysicsMode, clientPhysicsMode } from "./constants";
import ChooseUsername from "../choose-username/choose-username";

const Canvas1 = component$(({ world: localWorld }: { world: World }) => {
    const dimensions = localWorld.dimensions;
    const nav = useNavigate();
    const player = useSignal<Player | null>(null);

    const offscreenMap = useSignal<HTMLCanvasElement>();
    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();

    // could also use regular Dialog components for popups and menus, instead of drawing everything on the canvas
    // e.g. afk notice

    const nextSeq = useSeq();
    const predictionBuffer = useSignal<Array<Prediction>>([]);

    const clearPredictedMovesUpTo = $(
        (predictionArr: Prediction[], index: number) => {
            predictionArr.splice(0, index + 1);
        },
    );

    const onServerAck$ = $((msg: ServerAckMessage<ServerAckType>) => {
        const predictionArr = [...predictionBuffer.value];
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
        localWorld.player = {
            ...localWorld.player,
            ...msg.authoritativeState,
        };

        // 2. Remove confirmed actions up through index
        clearPredictedMovesUpTo(predictionArr, index);

        if (clientPhysicsMode !== ClientPhysicsMode.NONE) {
            // 3. Replay remaining predictions based on the corrected position
            for (const p of predictionArr) {
                applyActionToWorld(
                    localWorld,
                    p.action,
                    overlayRef.value!.getContext("2d")!,
                    {
                        collision: clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                    }
                );
            }
        }
        predictionBuffer.value = predictionArr;
        console.log('predictionBuffer remaining:', predictionArr);
    });

    const onPlayerMove$ = $((data: ServerPlayerMoveMessage) => {
        // skip self
        if (!data.playerId || data.playerId === localWorld.player.id) {
            return;
        }

        // e.g. updating from other clients
        const otherPlayerIndex = localWorld.otherPlayers.findIndex(
            (p) => p.id === data.playerId,
        );
        if (otherPlayerIndex === -1) return;

        // snap other players to new state
        const otherPlayer = localWorld.otherPlayers[otherPlayerIndex];
        localWorld.otherPlayers[otherPlayerIndex] = {
            ...otherPlayer,
            pos: data.pos,
            dir: data.dir,
        };
    });

    const onLoadCheckpoint$ = $(({ checkpoint }: ServerLoadCheckpointMessage) => {
        if (checkpoint.playerId !== localWorld.player.id) return console.log('PLAYER ID MISMATCH:', checkpoint.playerId, localWorld.player.id);
        localWorld.player = {
            ...localWorld.player,
            pos: {
                x: checkpoint.x,
                y: checkpoint.y,
            },
            dir: checkpoint.dir,
        }
        draw.player(localWorld, playersRef.value!.getContext("2d")!, localWorld.player);
    });

    const timeSinceLastCheckpoint = useSignal(Date.now());
    const onMessage$ = $(( ws: NoSerialize<WebSocket>, event: MessageEvent<string> ) => {
        console.log("onMessage data:", event.data);
        const data = JSON.parse(event.data) as ServerMessage;

        switch(data.type) {
            case('CLOSE_START'):
                applyCheckpointToServer(ws, localWorld.player, true);
                timeSinceLastCheckpoint.value = Date.now();
                break;
            case('TERMINATE'):
            case('CLOSE'):
                nav('/');
                break;
            case('AFK'):
                draw.afk(localWorld, overlayRef.value!.getContext("2d")!)
                break;
            case('ACK'):
            case('CORRECTION'):
            case('REJECTION'):
                onServerAck$(data);
                break;
            case("PLAYER_MOVE"):
                onPlayerMove$(data);
                break;
            case("LOAD_CHECKPOINT"):
                onLoadCheckpoint$(data);
                break;

            default:
                console.warn('INVALID MESSAGE TYPE RECEIVED:', data);
        }
    });

    const ws = useWebSocket(onMessage$, $((ws) => onInit(ws, localWorld.player)));

    /** =======================================================
     *          keyboard actions; apply to world
     * ======================================================= */
    useVimFSM(
        $(async (action): Promise<void> => {
            const seq = await nextSeq();
            // 1. Add to prediction buffer // for serverAck to replay if needed
            predictionBuffer.value.push({
                seq,
                action,
                snapshotBefore: { ...localWorld.player },
            });

            // 2. Apply local prediction
            applyActionToWorld(
                localWorld,
                action,
                overlayRef.value!.getContext("2d")!,
                {
                    collision: clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                    prediction: clientPhysicsMode !== ClientPhysicsMode.NONE,
                }
            );
            draw.clearAfk(localWorld, overlayRef.value!.getContext("2d")!)

            // 3. Send to server
            dispatchActionToServer(ws.value, seq, action);
        }),
        player,
    );


    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        // initialize offscreen canvas of map tiles /// is this needed?? offscreen map?
        const offscreenCanvas = draw.offscreenMap(localWorld);
        offscreenMap.value = offscreenCanvas;
        draw.visibleMap(mapRef.value!, offscreenCanvas);
        draw.helpHint(localWorld, overlayRef.value!.getContext("2d")!);

        const zero = Number(document.timeline.currentTime);
        const countFps = initFpsCounter(zero, 2);

        timeSinceLastCheckpoint.value = Date.now();


        // main client loop
        function loop(ts: number) {
            const { fps, ema } = countFps(ts);

            draw.objects(localWorld, objectsRef.value!);
            draw.players(localWorld, playersRef.value!);
            draw.fps(overlayRef.value!, fps, ema);
            // draw.afk(world, overlayRef.value!.getContext("2d")!); // testing
            const now = Date.now();

            // save checkpoint to server every min or 5 min or something (every 5s for testing)
            const difference = now - timeSinceLastCheckpoint.value;
            if (difference >= 5 * 1000) {
                timeSinceLastCheckpoint.value += difference;
                applyCheckpointToServer(ws.value!, localWorld.player, false);
            }

            requestAnimationFrame(loop);
        }

        loop(zero);
    });

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
            <ChooseUsername player={player} />
        </div>
    );
});

export default Canvas1;
