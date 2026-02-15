import { $, Signal, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { ServerWorld } from "~/server/types";
import {
    InitializeClientData,
    LocalWorldWrapper,
} from "../components/canvas1/types";
import { Player, Vec2 } from "~/types/worldTypes";
import { ClientPhysicsMode, clientPhysicsMode, getScaledTileSize } from "../components/canvas1/constants";
import { pickUpItem, pickUpObject } from "~/simulation/shared/actions/interact";
import { isWalkable, isWithinBounds } from "~/simulation/shared/helpers";
import { ServerAckMessage, ServerAckType } from "~/types/messageTypes";
import { applyActionToWorld } from "~/simulation/client/actions";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
// import { VimAction } from "~/fsm/types";
// import useSeq from "./useSeq";
// import { dispatch } from "./useWebSocket";

function useState(world: ServerWorld, isReady: Signal<boolean>, initializeSelfData: Signal<InitializeClientData | undefined>) {
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
            try {
                this.client.lastSnapshot = this.client.player && {
                    ...this.client.player,
                };

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
            this.world.dimensions.canvasWidth =
                newTileSize * this.world.dimensions.width;
            this.world.dimensions.canvasHeight =
                newTileSize * this.world.dimensions.height;
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

        onServerAck: $(async function (this: LocalWorldWrapper, msg: ServerAckMessage<ServerAckType>) {
            const predictionArr = [...this.client.predictionBuffer];
            // console.log({(566)
            //
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
                    ?.snapshotBefore || this.client.player;
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
                this.client.predictionBuffer = predictionArr;
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
                this.client.predictionBuffer = predictionArr;
                return;
            }

            // 1. Roll back to authoritative position
            // roll back to corrected position for that msg
            this.client.player = {
                ...this.client.player!,
                ...msg.authoritativeState,
                pos: {
                    ...this.client.player!.pos,
                    ...msg.authoritativeState.pos,
                },
            };
            console.log("EXPECT POSITION DIFFERENCE::", {
                lastSnapshot: { ...this.client.lastSnapshot },
                currentPlayer: { ...this.client.player },
            });
            this.client.lastSnapshot = { ...this.client.player! };

            // 2. Remove confirmed actions up through index
            predictionArr.splice(0, index + 1);

            this.client.predictionBuffer = predictionArr;
            this.client.isDirty.players = true;

            if (clientPhysicsMode === ClientPhysicsMode.NONE) return;

            console.log("~~ predictionBuffer replaying:", [...predictionArr]);

            const resultDirty = {
                players: false,
                objects: false,
                map: false,
            };
            // 3. Replay remaining predictions based on the corrected position
            for (const p of predictionArr) {
                const result = await applyActionToWorld(this, p.action);
                if (!result) continue;

                if (result.players) resultDirty.players = true;
                if (result.objects) resultDirty.objects = true;
                if (result.map) resultDirty.map = true;
            }
            // snapshot is current visual state of client
            this.client.lastSnapshot = { ...this.client.player! };
            Object.entries(resultDirty).forEach(([k, isDirty]) => {
                if (!isDirty) return;
                this.client.isDirty[
                    k as keyof typeof this.client.isDirty
                ] = true;
            });
        }),

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
