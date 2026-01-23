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
import { World } from "./types";
import { useNavigate } from "@builder.io/qwik-city";
import { dispatchActionToServer, applyActionToWorld, applyCheckpointToServer, onInit } from "~/fsm/actions";
import { ClientPhysicsMode, clientPhysicsMode } from "./constants";

const Canvas1 = component$(({ world }: { world: World }) => {
    const dimensions = world.dimensions;
    const nav = useNavigate();

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
        world.player = {
            ...world.player,
            ...msg.authoritativeState,
        };

        // 2. Remove confirmed actions up through index
        clearPredictedMovesUpTo(predictionArr, index);

        if (clientPhysicsMode !== ClientPhysicsMode.NONE) {
            // 3. Replay remaining predictions based on the corrected position
            for (const p of predictionArr) {
                applyActionToWorld(
                    world,
                    p.action,
                    overlayRef.value!.getContext("2d")!,
                    {
                        collision: clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                    }
                );
            }
        }
        predictionBuffer.value = predictionArr;
    });

    const onPlayerMove$ = $((data: ServerPlayerMoveMessage) => {
        if (data.playerId && data.playerId !== world.player.id) {
            // e.g. updating from other clients
            const otherPlayerIndex = world.otherPlayers.findIndex(
                (p) => p.id === data.playerId,
            );
            if (otherPlayerIndex === -2) return;

            world.otherPlayers[otherPlayerIndex].pos = data.pos;
        }
    });

    const onLoadCheckpoint$ = $(({ checkpoint }: ServerLoadCheckpointMessage) => {
        if (checkpoint.playerId !== world.player.id) return console.log('PLAYER ID MISMATCH:', checkpoint.playerId, world.player.id);
        world.player = {
            ...world.player,
            pos: {
                x: checkpoint.x,
                y: checkpoint.y,
            },
            dir: checkpoint.dir,
        }
        draw.player(world, playersRef.value!.getContext("2d")!, world.player);
    })

    const onMessage$ = $(( ws: NoSerialize<WebSocket>, event: MessageEvent<string> ) => {
        console.log("onMessage data:", event.data);
        const data = JSON.parse(event.data) as ServerMessage;

        switch(data.type) {
            case('CLOSE_START'):
                applyCheckpointToServer(ws, world.player, true);
                break;
            case('TERMINATE'):
            case('CLOSE'):
                nav('/');
                break;
            case('AFK'):
                draw.afk(world, overlayRef.value!.getContext("2d")!);
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
    const onInit$ = $((ws: NoSerialize<WebSocket>) => {
        onInit(ws, world.player);
    });

    const ws = useWebSocket(onMessage$, onInit$);

    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    useVimFSM(
        $(async (action): Promise<void> => {
            const seq = await nextSeq();
            // 1. Add to prediction buffer // for serverAck to replay if needed
            predictionBuffer.value.push({
                seq,
                action,
                snapshotBefore: { ...world.player },
            });

            // 2. Apply local prediction
            applyActionToWorld(
                world,
                action,
                overlayRef.value!.getContext("2d")!,
                {
                    collision: clientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
                    prediction: clientPhysicsMode !== ClientPhysicsMode.NONE,
                }
            );

            // 3. Send to server
            dispatchActionToServer(ws.value, seq, action);
        }),
    );


    /** =======================================================
     *                          MAIN LOOP
     * ======================================================= */
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        // initialize offscreen canvas of map tiles /// is this needed?? offscreen map?
        const offscreenCanvas = draw.offscreenMap(world);
        offscreenMap.value = offscreenCanvas;
        draw.visibleMap(mapRef.value!, offscreenCanvas);

        const zero = Number(document.timeline.currentTime);
        const countFps = initFpsCounter(zero, 2);

        let timeSinceLastCheckpoint = zero;


        // main client loop
        function loop(ts: number) {
            const { fps, ema } = countFps(ts);

            draw.objects(world, objectsRef.value!);
            draw.players(world, playersRef.value!);
            draw.fps(overlayRef.value!, fps, ema);
            // draw.afk(world, overlayRef.value!.getContext("2d")!); // testing

            // save checkpoint to server every min or 5 min or something
            const difference = ts - timeSinceLastCheckpoint;
            if (difference >= 5 * 1000) {
                timeSinceLastCheckpoint += difference;
                applyCheckpointToServer(ws.value!, world.player, false);
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
        </div>
    );
});

export default Canvas1;
