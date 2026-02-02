import { $, useSignal, useStore } from "@builder.io/qwik";
import { ServerWorld } from "~/server/types";
import {
    InitializeClientData,
    LocalWorldWrapper,
} from "../components/canvas1/types";
import { Player, Vec2 } from "~/types/worldTypes";
import { getScaledTileSize } from "../components/canvas1/constants";
import { findObjectInRange, pickUpItem, pickUpObject, placeObject } from "~/simulation/shared/interact";
import { isWalkable, isWithinBounds } from "~/simulation/client/helpers";

function useState(world: ServerWorld) {
    const mapRef = useSignal<HTMLCanvasElement>();
    const objectsRef = useSignal<HTMLCanvasElement>();
    const playersRef = useSignal<HTMLCanvasElement>();
    const overlayRef = useSignal<HTMLCanvasElement>();
    const offscreenMapRef = useSignal<HTMLCanvasElement>();

    const state = useStore<LocalWorldWrapper>({
        world: {
            ...world,
            lastScale: 0,
        },
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
            lastSnapshot: undefined,
        },
        show: {
            help: false,
            menu: false,
            afk: false,
            devStats: true,
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

        findObjectInRange: $(findObjectInRange),

        // ya: maybe need a "carry" slot on player; put the itemId in the "carry" slot, remove its position while carried?
        pickUpObject: $(pickUpObject),
        // yi: I guess remove the itemId from the object and add it to the player's items
        pickUpItem: $(pickUpItem),
        // later: pa" pi"
        placeObject: $(placeObject),
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
