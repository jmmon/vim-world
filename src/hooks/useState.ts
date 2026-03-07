import { $, Signal, useSignal, useStore } from "@builder.io/qwik";
import { World } from "~/server/types";
import {
    InitializeClientData,
    IsDirty,
    LocalWorldWrapper,
} from "../components/canvas1/types";
import { Player, Vec2 } from "~/types/worldTypes";
import { pickUpItem, pickUpObject } from "~/simulation/shared/actions/interact";
import { isWalkable, isWithinBounds } from "~/simulation/shared/helpers";
import { applyActionToWorld } from "~/simulation/client/actions";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { getScaledTileSize } from "~/services/draw/utils";
import chunkService from "~/services/chunk";
import { setPlayerPos } from "~/simulation/client/movement";
import { ClientPhysicsMode, getClientPhysics } from "~/simulation/shared/physics";
import { ServerAckMessage, SubtypeServerAck } from "~/types/wss/server";
// import { VimAction } from "~/fsm/types";
// import useSeq from "./useSeq";
// import { dispatch } from "./useWebSocket";

function useState(world: World, isReady: Signal<boolean>) {
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
            lastScale: 0,
        },
        physics: getClientPhysics(ClientPhysicsMode.VISUAL_ONLY),
        client: {
            player: undefined,
            username: undefined,
            usernameHash: undefined,
            lastProcessedSeq: undefined,
            afkStartTime: -1,
            idleStartTime: Date.now(),
            timeSinceLastCheckpoint: Date.now(),
            isDirty: {
                players: true,
                objects: true,
                map: true,
            },
            predictionBuffer: [],
            commandBuffer: "",
            lastSnapshot: undefined,
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
            chunkService.handleChunkChange(this.client.player, this.world.config)
            this.client.isDirty.map = true; // for chunk overlay
            console.log("initializeSelf complete!:", data);
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
            return getScaledTileSize(scale);
        }),
        // client only
        markAllDirty: $(function (this: LocalWorldWrapper) {
            this.client.isDirty.map = true;
            this.client.isDirty.objects = true;
            this.client.isDirty.players = true;
        }),
        updateScale: $(function (this: LocalWorldWrapper, newScale: number, newTileSize: number) {
            this.world.dimensions.scale = newScale;
            this.world.dimensions.tileSize = newTileSize;
            this.world.dimensions.viewportWidthPx =
                newTileSize * this.world.dimensions.worldWidthBlocks;
            this.world.dimensions.viewportHeightPx =
                newTileSize * this.world.dimensions.worldHeightBlocks;
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

            // Prediction not matched, roll back player
            const newPos = {
                ...this.client.player!.pos,
                ...authoritativeState.pos,
            };
            const changed = setPlayerPos(this.client.player!, newPos, this.world.config);
            this.client.player = {
                ...this.client.player!,
                ...authoritativeState,
            };

            const anyDirty: IsDirty = {
                players: true,
                objects: false,
                map: changed,
            };

            this.client.lastSnapshot = { ...this.client.player! };

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
                this.client.isDirty = {...anyDirty};
                return;
            }

            // 3. Replay remaining predictions based on the corrected position
            for (const p of predictionArr) {
                const isDirty = await applyActionToWorld(this, p.action);
                if (!isDirty) continue;

                anyDirty.players = isDirty.players || anyDirty.players;
                anyDirty.objects = isDirty.objects || anyDirty.objects;
                anyDirty.map = isDirty.map || anyDirty.map;
            }
            this.client.isDirty = {...anyDirty};

            // save last snapshot received from server - should maybe happen before replaying??
            // this.client.lastSnapshot = { ...this.client.player! };
        }),






    });

    return {
        refs: {
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
