import { $, Signal, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { World } from "~/server/types";
import {
    InitializeClientData,
    IsDirty,
    LocalWorldWrapper,
} from "../components/canvas1/types";
import { Player, Vec2 } from "~/types/worldTypes";
import { ClientPhysicsMode, clientPhysicsMode } from "../components/canvas1/constants";
import { pickUpItem, pickUpObject } from "~/simulation/shared/actions/interact";
import { isWalkable, isWithinBounds } from "~/simulation/shared/helpers";
import { ServerAckMessage, ServerAckType } from "~/types/messageTypes";
import { applyActionToWorld } from "~/simulation/client/actions";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { getScaledTileSize } from "~/services/draw/utils";
// import { VimAction } from "~/fsm/types";
// import useSeq from "./useSeq";
// import { dispatch } from "./useWebSocket";

function useState(world: World, isReady: Signal<boolean>, initializeSelfData: Signal<InitializeClientData | undefined>) {
    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();
    const offscreenMapRef = useSignal<HTMLCanvasElement>();

    // const getNextSeq = useSeq(); // action index

    const state = useStore<LocalWorldWrapper>({
        world: {
            ...world,
            lastScale: 0,
        },
        physics: clientPhysicsMode,
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
            commandBuffer: '',
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
            return isWithinBounds(this.world.dimensions, target);
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
            this.client.lastSnapshot = this.client.player;

            this.client.player = data.player;
            this.client.username = data.username;
            this.client.usernameHash = data.usernameHash;
            this.client.lastProcessedSeq = -1;

            console.log("initializeSelf complete!:", data);
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

        onServerAck: $(async function (this: LocalWorldWrapper, { authoritativeState, seq }: ServerAckMessage<ServerAckType>) {
            if (seq < (this.client.lastProcessedSeq ?? -1)) return;
            const predictionArr = [...this.client.predictionBuffer];

            const index = predictionArr.findIndex((p) => p.seq === seq);
            if (index === -1) return;
            this.client.lastProcessedSeq = seq;

            // NOTE: skip if results of the changes matched: for full prediction on the client
            // - if no client visual prediction, then the resultState and authState would NOT match since client would be behind

            const predicted =
                predictionArr[predictionArr.findIndex((p) => p.seq === seq + 1)]
                    ?.snapshotBefore || this.client.player;

            const isPredictedMatchingAuthoritative = 
                authoritativeState?.pos &&
                authoritativeState.dir &&
                predicted.pos.x === authoritativeState.pos.x &&
                predicted.pos.y === authoritativeState.pos.y &&
                predicted.dir === authoritativeState.dir;


            // Prediction matched — just drop it
            if (!authoritativeState || isPredictedMatchingAuthoritative) {
                // clear everything before it as well
                predictionArr.splice(0, index + 1);
                this.client.predictionBuffer = predictionArr;
                console.log("~~ results are same: remaining predictions:", {
                    remaining: [...predictionArr],
                    index,
                    resultState: { ...predicted },
                });
                return;
                // no need to replay anything since there was no correction
            }

            // Prediction not matched, roll back player
            const newPos = {
                ...this.client.player!.pos,
                ...authoritativeState.pos,
            };
            this.client.player = {
                ...this.client.player!,
                ...authoritativeState,
                pos: newPos,
            };

            const anyDirty: IsDirty = {
                players: true,
                objects: false,
                map: true, // have to "roll back" map as well; easier to just rerender
                // map: chunkBefore.chunkX - chunkAfter.chunkX !== 0 || chunkBefore.chunkY - chunkAfter.chunkY !== 0,
            };
            console.log('EXPECT MAP DIRTY:', anyDirty);

            // console.log("EXPECT POSITION DIFFERENCE::", {
            //     lastAckedSnapshot: { ...this.client.lastSnapshot },
            //     currentPlayer: { ...this.client.player },
            // });

            this.client.lastSnapshot = { ...this.client.player! };


            // Remove confirmed actions including this seq
            predictionArr.splice(0, index + 1);

            this.client.predictionBuffer = predictionArr;
            console.log("~~ predictionBuffer remaining:", [...predictionArr]);

            // NOTE: after moving to a client tick model, no need to applyActionToWorld here!
            // just reset the predictionArr and then the game tick will apply and set to dirty.
            // Everything below will be moved to tick

            if (!(await this.getPhysicsPrediction())) {
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

        // TODO: change this to be more of a rule structure for server and for client
        getPhysicsCollision: $(function(this: LocalWorldWrapper) {return this.physics === ClientPhysicsMode.FULL_PREDICTION}), 
        getPhysicsPrediction: $(function(this: LocalWorldWrapper) {return this.physics !== ClientPhysicsMode.NONE}), 
    });

    const lastInit = useSignal(0);
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async ({ track }) => {
        const selfData = track(initializeSelfData);
        if (!selfData) return;

        const success = await state.initClientData(selfData);
        if (!success)
            return console.error("error initializing self!", selfData);
        state.client.isDirty.players = true;

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
