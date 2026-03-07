import { $, Signal, useSignal, useStore } from "@builder.io/qwik";
import { World } from "~/server/types";
import {
    InitializeClientData,
    IsDirty,
    LocalWorldWrapper,
    ApplyActionDirtyResult,
} from "../components/canvas1/types";
import { Vec2 } from "~/types/worldTypes";
import { pickUpItem, pickUpObject } from "~/simulation/shared/actions/interact";
import { isWalkable, isWithinBounds } from "~/simulation/shared/helpers";
import { applyActionToWorld } from "~/simulation/client/actions";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { getScaledTileSize } from "~/services/draw/utils";
import chunkService from "~/services/chunk";
import { ClientPhysicsMode, getClientPhysics } from "~/simulation/shared/physics";
import { setPlayerPos, updateViewportPos } from "~/simulation/client/movement";
import { ServerAckMessage, ServerInitConfirmMessage, ServerOtherPlayerMessage, SubtypeServerAck } from "~/types/wss/server";
import useDispatch$ from "./useDispatch";

function useState(world: World, isReady: Signal<boolean>, dispatch$: ReturnType<typeof useDispatch$>) {
    const containerRef = useSignal<HTMLDivElement>();
    const offscreenMapRef = useSignal<HTMLCanvasElement>();
    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();

    // const getNextSeq = useSeq(); // action index

    const lastInit = useSignal(0);

    const state = useStore<LocalWorldWrapper>({
        world: {
            ...world,
        },
        physics: getClientPhysics(ClientPhysicsMode.VISUAL_ONLY),
        client: {
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
            predictionBuffer: [],
            commandBuffer: "",
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
        isWithinBounds: $(function (this: LocalWorldWrapper, target: Vec2) {
            return isWithinBounds(this, target);
        }),
        isWalkable: $(function (this: LocalWorldWrapper, target: Vec2) {
            return isWalkable(this, target);
        }),
        initClientData: $(function (
            this: LocalWorldWrapper,
            data: InitializeClientData,
        ) {
            this.client.lastSnapshot = this.client.player;

            this.client.player = data.player;
            this.client.username = data.username;
            this.client.usernameHash = data.usernameHash;
            this.client.lastProcessedSeq = -1;

            chunkService.handleVisibleChunksChange(
                this.client.player.pos,
                this.world.config,
            );
            updateViewportPos(this);
            this.markAllDirty();

            const now = Date.now();
            console.assert(
                now - lastInit.value > 5000,
                "!!initializing called many times!!",
            );
            console.log(
                "initialized localWorld with client data, NOW READY::",
                data,
            );

            lastInit.value = now;
            isReady.value = true;
            return true;
        }),
        // client only
        getScaledTileSize: $(function (this: LocalWorldWrapper, scale: number) {
            return getScaledTileSize(this.world.config, scale);
        }),
        // client only
        markAllDirty: $(function (this: LocalWorldWrapper) {
            console.log('marking all dirty');
            this.client.isDirty.overlay = true;
            this.client.isDirty.objects = true;
            this.client.isDirty.players = true;
            this.client.isDirty.map = true;
        }),
        clearAllDirty: $(function (this: LocalWorldWrapper) {
            console.log('clearing all dirty');
            this.client.isDirty.overlay = false;
            this.client.isDirty.objects = false;
            this.client.isDirty.players = false;
            this.client.isDirty.map = false;
        }),
        // client only
        updateScale: $(function (
            this: LocalWorldWrapper,
            newScale: number,
            newTileSize: number,
        ) {
            this.client.viewport.width =
                newTileSize *
                (this.client.viewport.width / this.world.config.tileSize);
            this.client.viewport.height =
                newTileSize *
                (this.client.viewport.height / this.world.config.tileSize);
            this.world.config.scale = newScale;
            this.world.config.tileSize = newTileSize;
        }),

        findObjectInRangeByKey: $(findObjectInRangeByKey),

        // ya: maybe need a "carry" slot on player; put the itemId in the "carry" slot, remove its position while carried?
        pickUpObject: $(pickUpObject),
        // yi: I guess remove the itemId from the object and add it to the player's items
        pickUpItem: $(pickUpItem),
        // later: pa" pi"
        // placeObject: $(placeObject),
        // placeItem: $(placeItem),
        // placeItem: $(placeItem),

        onServerAck: $(async function (
            this: LocalWorldWrapper,
            msg: ServerAckMessage<SubtypeServerAck>,
        ) {
            if ("subtype" in msg && msg.subtype === "CHECKPOINT") {
                this.client.lastAckCheckpoint = (msg as ServerAckMessage<"CHECKPOINT">).checkpoint;
                // this.client.lastSnapshot = 
                //         checkpointService.toPlayer(
                //     (msg as ServerAckMessage<"CHECKPOINT">).checkpoint,
                //     this.client.lastProcessedSeq,
                // );
                return;
            }

            const { seq, authoritativeState } = msg;

            if (seq < (this.client.lastProcessedSeq ?? -1)) return;
            const predictionArr = [...this.client.predictionBuffer];

            const index = predictionArr.findIndex((p) => p.seq === seq);
            if (this.physics.prediction && index === -1) return console.log('~prediction running, but buffer is missing:', seq);
            this.client.lastProcessedSeq = seq;

            // NOTE: skip if results of the changes matched: for full prediction on the client
            // - if no client visual prediction, then the resultState and authState would NOT match since client would be behind

            const result =
                predictionArr[predictionArr.findIndex((p) => p.seq === seq + 1)]
                    ?.snapshotBefore || this.client.player;

            const isPredictionMatching =
                this.physics.prediction &&
                authoritativeState?.pos &&
                authoritativeState.dir &&
                result.pos.x === authoritativeState.pos.x &&
                result.pos.y === authoritativeState.pos.y &&
                result.dir === authoritativeState.dir;

            // Prediction matched — just drop it
            if (!authoritativeState || isPredictionMatching) {
                // clear everything before it as well
                predictionArr.splice(0, index + 1);
                this.client.predictionBuffer = predictionArr;
                console.log("~~ results are same: remaining predictions:", {
                    remaining: [...predictionArr],
                    index,
                    resultState: { ...result },
                });
                return;
                // no need to replay anything since there was no correction
            }

            // Prediction not matched, roll back player according to ack player
            const next = {
                ...this.client.player!.pos,
                ...authoritativeState.pos,
            };
            const isSameChunk = setPlayerPos(this, next);
            this.client.player!.dir =
                authoritativeState.dir || this.client.player!.dir; // update dir before viewport!
            const viewportChanged =
                (await this.updateViewportDimensions()) || updateViewportPos(this);
            console.log({next, viewportChanged, isSameChunk});
            this.client.player = {
                ...this.client.player!,
                ...authoritativeState,
            };

            const anyDirty: IsDirty = {
                overlay: !isSameChunk,
                players: true, // redraw player when player is moved
                objects: viewportChanged, // only redraw when viewport changes
                map: viewportChanged,
            };
            await this.updateIsDirty(anyDirty);
            console.log("EXPECT MAP DIRTY if prediction is running:", anyDirty);
            console.log('EXPECT all properties on player::', this.client.player);

            // Remove confirmed actions including this seq
            predictionArr.splice(0, index + 1);

            this.client.predictionBuffer = predictionArr;
            console.log("~~ predictionBuffer remaining:", [...predictionArr]);

            // NOTE: after moving to a client tick model, no need to applyActionToWorld here!
            // just reset the predictionArr and then the game tick will apply and set to dirty.
            // Everything below will be moved to tick

            if (!this.physics.prediction) {
                return;
            }

            // 3. Replay remaining predictions based on the corrected position
            for (const p of predictionArr) {
                const isDirty = await applyActionToWorld(this, p.action);
                await this.updateIsDirty(isDirty);
            }
        }),
        onOtherPlayerMove: $(function (this: LocalWorldWrapper, data: ServerOtherPlayerMessage<"MOVE">)  {
            // skip self
            if (!data.playerId || data.playerId === this.client.player?.id) {
                return;
            }

            // TODO: ignore if not within visibleChunks
            // TODO: reload other players when visibleChunks changes

            // e.g. updating from other clients: find the moving player and move it
            const otherPlayer = this.world.players.get(data.playerId);
            if (!otherPlayer) return;

            otherPlayer.pos = data.pos;
            otherPlayer.dir = data.dir;

            this.client.isDirty.players = true;
        }),
        onInitConfirm: $(function (data: ServerInitConfirmMessage) {
            console.assert(
                data.subtype === "CONFIRM",
                'EXPECTED subtype "CONFIRM", got',
                data.subtype,
            );
            console.log("RECEIVED INIT CONFIRM:", { data });
            console.assert(
                localStorage.getItem("playerId") === data.playerId,
                "!! playerId mismatch!!",
            );
        }),
        updateViewportDimensions: $(function (this: LocalWorldWrapper) {
            const { lines, columns } = this.client.settings;
            const { tileSize } = this.world.config;
            const prev = { ...this.client.viewport };

            console.log('setting viewport width/height...');
            this.client.viewport.width = columns * tileSize;
            this.client.viewport.height = lines * tileSize;

            const hasChanged =
                prev.height !== this.client.viewport.height ||
                prev.width !== this.client.viewport.width;

            // if styles are not attached in the jsx
            if (hasChanged) {
                console.log("new viewport:", this.client.viewport);
                containerRef.value!.style.width =
                    mapRef.value!.style.width =
                    objectsRef.value!.style.width =
                    playersRef.value!.style.width =
                    overlayRef.value!.style.width =
                        this.client.viewport.width + "px";
                containerRef.value!.style.height =
                    mapRef.value!.style.height =
                    objectsRef.value!.style.height =
                    playersRef.value!.style.height =
                    overlayRef.value!.style.height =
                        this.client.viewport.height + "px";
            }
            return hasChanged;
        }),
        updateIsDirty: $(function (
            this: LocalWorldWrapper,
            isDirty: ApplyActionDirtyResult,
        ) {
            if (isDirty) {
                this.client.isDirty.overlay ||=
                    isDirty === true || !!isDirty.overlay;
                this.client.isDirty.players ||=
                    isDirty === true || !!isDirty.players;
                this.client.isDirty.objects ||=
                    isDirty === true || !!isDirty.objects;
                this.client.isDirty.map ||= isDirty === true || !!isDirty.map;
            }
        }),
        dispatch: dispatch$,
    });

    return {
        refs: {
            container: containerRef,
            map: mapRef,
            objects: objectsRef,
            players: playersRef,
            overlay: overlayRef,
            offscreenMap: offscreenMapRef,
        },
        ctx: state,
    };
}

export type GameState = ReturnType<typeof useState>;
export default useState;
