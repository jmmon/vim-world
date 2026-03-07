import { NoSerialize, Signal, useSignal, useStore } from "@builder.io/qwik";
import {
    InitializeClientData,
    IsDirty,
    LocalWorldWrapper,
    ApplyActionDirtyResult,
} from "../components/canvas1/types";
import { Player } from "~/types/worldTypes";
import { mergePlayerState } from "~/simulation/shared/helpers";
import { applyActionToWorld } from "~/simulation/client/actions";
import chunkService from "~/services/chunk";
import {
    ClientPhysicsMode,
    getClientPhysics,
} from "~/simulation/shared/physics";
import { updatePlayerMovement } from "~/simulation/client/movement";
import {
    ServerAckMessage,
    ServerInitConfirmMessage,
    ServerOtherPlayerMessage,
    SubtypeServerAck,
} from "~/types/wss/server";
import useDispatch$ from "./useDispatch";
import { VimAction } from "~/fsm/types";
import { World } from "~/server/types";
import viewport from "~/simulation/client/viewport";

export const handlers = {
    markAllDirty: function (ctx: LocalWorldWrapper) {
        console.log("marking all dirty");
        ctx.client.isDirty.overlay = true;
        ctx.client.isDirty.objects = true;
        ctx.client.isDirty.players = true;
        ctx.client.isDirty.map = true;
    },
    clearAllDirty: function (ctx: LocalWorldWrapper) {
        console.log("clearing all dirty");
        ctx.client.isDirty.overlay = false;
        ctx.client.isDirty.objects = false;
        ctx.client.isDirty.players = false;
        ctx.client.isDirty.map = false;
    },

    updateIsDirty: function (
        ctx: LocalWorldWrapper,
        isDirty: ApplyActionDirtyResult,
    ) {
        if (isDirty) {
            ctx.client.isDirty.overlay ||=
                isDirty === true || !!isDirty.overlay;
            ctx.client.isDirty.players ||=
                isDirty === true || !!isDirty.players;
            ctx.client.isDirty.objects ||=
                isDirty === true || !!isDirty.objects;
            ctx.client.isDirty.map ||= isDirty === true || !!isDirty.map;
        }
    },

    updateScale: function (
        ctx: LocalWorldWrapper,
        newScale: number,
        newTileSize: number,
    ) {
        ctx.client.viewport.width =
            newTileSize *
            (ctx.client.viewport.width / ctx.world.config.tileSize);
        ctx.client.viewport.height =
            newTileSize *
            (ctx.client.viewport.height / ctx.world.config.tileSize);
        ctx.world.config.scale = newScale;
        ctx.world.config.tileSize = newTileSize;
    },

    handleComparePrediction: function (
        ctx: LocalWorldWrapper,
        result: Player,
        indexAction: number,
        authoritativeState?: Partial<Player>,
    ) {
        const inputBuffer = ctx.client.inputBuffer.slice();
        const isPredictionMatching =
            authoritativeState &&
            authoritativeState.pos &&
            authoritativeState.dir &&
            result.carryingObjId ===
                (authoritativeState?.carryingObjId ?? "") &&
            result.pos.x === authoritativeState.pos.x &&
            result.pos.y === authoritativeState.pos.y &&
            result.dir === authoritativeState.dir;

        // Prediction matched — just drop it
        if (!authoritativeState || isPredictionMatching) {
            // clear everything before it as well
            ctx.client.inputBuffer = inputBuffer.slice(indexAction + 1);

            console.log("~~ results are same: remaining predictions:", {
                remaining: [...inputBuffer],
                index: indexAction,
                resultState: { ...result },
            });
            return true;
            // no need to replay anything since there was no correction
        }
        return false;
    },

    /**
     * @returns true if handled, false if not
     * */
    handleAckSubtype: function (
        ctx: LocalWorldWrapper,
        msg: ServerAckMessage<SubtypeServerAck>,
    ): boolean {
        switch (msg.subtype) {
            case "CHECKPOINT":
                ctx.client.lastAckCheckpoint = (
                    msg as ServerAckMessage<"CHECKPOINT">
                ).checkpoint;
                return true;
            case "COMMAND_PARTIAL":
                // update the statusbar as chars are typed
                ctx.client.commandBuffer =
                    ":" + msg.authoritativeState!.commandLineState!.buffer;
                return true;
            case "COMMAND": {
                // should run the command in case we aren't running command prediction
                if (ctx.physics.prediction) return true;

                if (
                    (msg.authoritativeState?.commandLineState?.buffer ||
                        "")[0] === ":"
                ) {
                    msg.authoritativeState!.commandLineState!.buffer.replace(
                        ":",
                        "",
                    );
                }
                const command =
                    msg.authoritativeState?.commandLineState?.buffer || "";
                console.assert(command.length, "no command found");

                // finalize statusbar so correct command can run
                ctx.client.commandBuffer = command;

                const reason = applyActionToWorld(ctx, {
                    type: "COMMAND",
                    command,
                });
                handlers.updateIsDirty(ctx, reason.isDirty);
                return true;
            }
        }
        return false;
    },

    /* action: steps
     * 10j => 3j * 3 + 1j
     * seq:
     * 22l => 21 * 3 + 22
     *
     *
     *
     *
     * Ok so once we get that server ack, we need to remove actionQueue for that seq
     *  - need to make sure the server completing first will cause the client
     *      to break the loop instead of duplicating moves
     * */
    onServerAck: function (
        ctx: LocalWorldWrapper,
        msg: ServerAckMessage<SubtypeServerAck>,
    ) {
        // ================================================================
        // handle subtype: checkpoint, commands
        // ================================================================
        if ("subtype" in msg && handlers.handleAckSubtype(ctx, msg)) {
            return //console.log('~ handled subtype:', msg.subtype);
        }

        const { seq, authoritativeState, tick } = msg;
        const TOLERANCE = 2;
        console.assert(
            tick >= ctx.client.tick - TOLERANCE,
            "GOT AN OLD TICK::",
            tick,
            " ours:",
            ctx.client.tick,
        );
        ctx.client.tick = tick; // not really sure how to sync this with server

        ctx.client.lastProcessedSeq ??= -1;
        if (seq < ctx.client.lastProcessedSeq)
            return console.log(
                `received old sequence: ${seq} -- we're at ${ctx.client.lastProcessedSeq} `,
            );

        const inputBuffer = ctx.client.inputBuffer.slice();
        const index = inputBuffer.findIndex((p) => p.seq === seq);
        if (ctx.physics.prediction && index === -1) {
            return console.log(
                "~ prediction running, but buffer is missing, maybe it's old:",
                seq,
                ` (${ctx.client.lastProcessedSeq} lastProcessedSeq)`,
            );
        }

        ctx.client.lastProcessedSeq = Math.max(
            seq,
            ctx.client.lastProcessedSeq,
        );
        // const input = inputBuffer[index];
        // const count = input.action.count ?? 1;
        // const steps = Math.ceil(count / 3);
        // const remainderLast = count % 3;

        // ================================================================
        // prediction: check against next snapshot, ignore if matching
        // - if no next snapshot, or if prediction is not running, check against current player
        // ================================================================
        const indexPredictedResult = inputBuffer.findIndex(
            (p) => p.seq === seq + 1,
        );
        const hasPredictionResult =
            ctx.physics.prediction && indexPredictedResult !== -1;
        const result = hasPredictionResult
            ? inputBuffer[indexPredictedResult].snapshotBefore
            : ctx.client.player!;
        const isMatching = handlers.handleComparePrediction(
            ctx,
            result,
            index,
            authoritativeState,
        );

        const indexLastStepForSeq = ctx.client.actionQueue.findIndex(
            (ea) => ea.remaining === 0 && ea.seq === seq,
        );
        if (isMatching) {
            // TODO: handle only removing the one partial step, based on the original action
            // this would handle only the last step or clearing all including the last step
            if (indexLastStepForSeq > -1)
                ctx.client.actionQueue.splice(0, indexLastStepForSeq + 1);
        }
        // ================================================================
        // clear action queue steps that are stale!
        if (isMatching || !authoritativeState) return console.log('~~ matching, or no authoritative state');

        // for dirtying objects:
        const isSameItem =
            ctx.client.player!.carryingObjId ===
            (authoritativeState?.carryingObjId ?? "");

        // ================================================================
        // Prediction not matched, roll back player according to ack player
        // ================================================================
        const target = {
            ...ctx.client.player!.pos,
            ...authoritativeState.pos,
        };
        const isSameChunk = updatePlayerMovement(ctx, {
            target,
            dir: authoritativeState.dir,
        });

        const viewportChanged =
            viewport.updateDimensions(ctx) || viewport.updatePos(ctx);

        console.log("onserverAck$:", {
            nextPos: target,
            viewportChanged,
            isSameChunk,
        });

        mergePlayerState(ctx, authoritativeState);

        const anyDirty: IsDirty = {
            overlay: !isSameChunk,
            players: true, // redraw player when player is moved
            objects: !isSameItem || viewportChanged,
            map: viewportChanged,
        };
        handlers.updateIsDirty(ctx, anyDirty);


        // ================================================================
        // Remove confirmed actions including this seq
        // ================================================================
        inputBuffer.splice(0, index + 1);

        ctx.client.inputBuffer = inputBuffer;
        console.log("~~ predictionBuffer remaining:", [...inputBuffer]);

        if (indexLastStepForSeq > -1) {
            ctx.client.actionQueue.splice(0, indexLastStepForSeq + 1);
            console.assert(
                !isMatching,
                "WARNING: may have double-removed the last step from queue!!",
                JSON.stringify(ctx.client.actionQueue),
            );
        }

        // ================================================================
        // NOTE: after moving to a client tick model, no need to applyActionToWorld here!
        // just reset the predictionArr and then the game tick will apply and set to dirty.
        // Everything below will be moved to tick
        //
        // - or: do I need to replay immediately to get it back in sync??
        // - either way: need to get the correct expandedAction step and replay from there,
        //      NOT replay the entire action
        // ================================================================

        if (!ctx.physics.prediction) return;

        // Replay remaining predictions based on the corrected position
        for (const p of inputBuffer) {
            const reason = applyActionToWorld(ctx, p.action);
            handlers.updateIsDirty(ctx, reason.isDirty);
        }
    },

    onOtherPlayerMove: function (
        ctx: LocalWorldWrapper,
        data: ServerOtherPlayerMessage<"MOVE">,
    ) {
        // skip self
        if (!data.playerId || data.playerId === ctx.client.player?.id) {
            return;
        }

        // TODO: ignore if not within visibleChunks
        // TODO: reload other players when visibleChunks changes

        // e.g. updating from other clients: find the moving player and move it
        const otherPlayer = ctx.world.players.get(data.playerId);
        if (!otherPlayer) return;

        otherPlayer.pos = data.pos;
        otherPlayer.dir = data.dir;

        ctx.client.isDirty.players = true;
    },

    /**
     * applies a step, called 3 times per tick
     * @returns the reason for cancelling  TODO:
     * */
    applyActionStep: function (
        ctx: LocalWorldWrapper,
        action: VimAction,
        tick: number,
    ) {
        /*
         * server: does basic validation
         * apply to world, take reason
         * */

        const result = applyActionToWorld(ctx, action);
        handlers.updateIsDirty(ctx, result.isDirty);

        console.log(
            `afterActionStep: tick ${tick}::`,
            {
                name: ctx.client.player!.name,
                id: ctx.client.player!.id,
                x: ctx.client.player!.pos.x,
                y: ctx.client.player!.pos.y,
                dir: ctx.client.player!.dir,
            },
        );

        // return reason for breaking early
        return result.reason;
    },

    initClientData: function (
        ctx: LocalWorldWrapper,
        data: InitializeClientData,
    ) {
        ctx.client.lastSnapshot = ctx.client.player;

        ctx.client.player = data.player;
        ctx.client.username = data.username;
        ctx.client.usernameHash = data.usernameHash;
        ctx.client.lastProcessedSeq = -1;

        chunkService.handleVisibleChunksChange(
            ctx.client.player.pos,
            ctx.world.config,
        );
        viewport.updatePos(ctx);
        handlers.markAllDirty(ctx);

        const now = Date.now();
        console.assert(
            now - ctx.client.lastInit > 5000,
            "!!initializing called many times!!",
        );
        console.log(
            "initialized localWorld with client data, NOW READY for websocket!::",
            data,
        );

        ctx.client.lastInit = now;
        ctx.client.isReady = true;
        return true;
    },

    onInitConfirm: function (
        ctx: LocalWorldWrapper,
        data: ServerInitConfirmMessage,
    ) {
        console.assert(
            data.subtype === "CONFIRM",
            'EXPECTED subtype "CONFIRM", got',
            data.subtype,
        );
        console.log("RECEIVED INIT CONFIRM:", { data });

        if (data.tick) {
            console.assert(
                data.tick > ctx.client.tick,
                "!!server is behind??::",
                data,
                ctx.client.tick,
            );
            ctx.client.tick = data.tick;
        }
        console.assert(
            localStorage.getItem("playerId") === data.playerId,
            "!! playerId mismatch!!",
        );
    },
};

function useState(world: World<"Client">, ws: Signal<NoSerialize<WebSocket>>,) {
    const containerRef = useSignal<HTMLDivElement>();
    const offscreenMapRef = useSignal<HTMLCanvasElement>();
    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();
    const dispatch$ = useDispatch$(ws);

    // const getNextSeq = useSeq(); // action index

    const ctx = useStore<LocalWorldWrapper>({
        world,
        physics: getClientPhysics(ClientPhysicsMode.NONE),
        dispatch: dispatch$,
        client: {
            isReady: false,
            lastInit: 0,
            settings: {
                scrolloff: 10,
                sidescrolloff: 10,
                lines: 32,
                columns: 32,
                // lines: 42,
                // columns: 42,
            },
            // should be independant from scale::
            // changing scale should NOT change viewport, it should instead change how many tiles are showing
            viewport: {
                origin: {
                    x: 0,
                    y: 0,
                },
                // width: 0,
                // height: 0,
                width: 1024,
                height: 1024,
            },
            player: undefined,
            username: undefined,
            usernameHash: undefined,
            lastProcessedSeq: undefined,
            afkStartTime: -1,
            idleStartTime: Date.now(),
            timeSinceLastCheckpoint: Date.now(),
            isDirty: {
                overlay: true,
                players: true,
                objects: true,
                map: true,
            },
            inputBuffer: [],
            actionQueue: [],
            tick: -1,
            commandBuffer: "", // to be displayed in the bar // TODO: mimick server logic and structure
            lastSnapshot: undefined,
            lastAckCheckpoint: undefined,
        },
        show: {
            help: false,
            helpHint: false,
            menu: false,
            afk: false,
            devStats: true,
        },
    });

    const state = {
        refs: {
            container: containerRef,
            map: mapRef,
            objects: objectsRef,
            players: playersRef,
            overlay: overlayRef,
            offscreenMap: offscreenMapRef,
        },
        ctx: ctx,
    };
    return state;
}

export type GameState = ReturnType<typeof useState>;
export default useState;
