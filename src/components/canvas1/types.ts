import { QRL } from "@builder.io/qwik";
import { VimAction } from "~/fsm/types";
import { ServerWorld } from "~/server/types";
import { ServerAckMessage, ServerAckType } from "~/types/messageTypes";
import { Player, Vec2, WorldEntity } from "~/types/worldTypes";
import { ClientPhysicsMode } from "./constants";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";

export interface Prediction {
    seq: number;
    action: VimAction;
    snapshotBefore: Player;
}
export type IsDirty = {
    players: boolean,
    objects: boolean,
    map: boolean,
};

export type ClientData = {
    player?: Player; // not really needed??? but might be better to look up once only
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
    afkStartTime: number;
    idleStartTime: number;
    timeSinceLastCheckpoint: number;
    isDirty: IsDirty;
    predictionBuffer: Prediction[];
    commandBuffer: string;
    lastSnapshot?: Player;
};
export type InitializeClientData = {
    player: Player;
    username: string;
    usernameHash: string;
};
export type InterfaceData = {
    show: {
        help: boolean;
        menu: boolean;
        afk: boolean;
        devStats: boolean;
    };
};

export type LocalWorldWrapper = InterfaceData & {
    world: ServerWorld & {
        lastScale: number;
    };
    physics: ClientPhysicsMode;
    client: ClientData;
    isWithinBounds: QRL<(target: Vec2) => boolean>;
    isWalkable: QRL<(target: Vec2) => boolean>;
    addPlayer: QRL<(player: Player) => boolean>;
    initClientData: QRL<(data: InitializeClientData) => boolean>;
    getScaledTileSize: QRL<
        (desiredScale: number) => { actualScale: number; tileSize: number }
    >;
    markAllDirty: QRL<() => void>;
    updateScale: QRL<(newScale: number, newTileSize: number) => void>;
    findObjectInRangeByKey: QRL<
        (player: Player, key: string) => ReturnType<typeof findObjectInRangeByKey>
    >;
    pickUpObject: QRL<(obj: WorldEntity, player: Player) => boolean>;
    pickUpItem: QRL<(obj: WorldEntity, player: Player) => boolean>;

    // placeObject: QRL<
    //     (
    //         obj: MapObject,
    //         player: Player,
    //         target: Vec2,
    //     ) => boolean | Promise<boolean>
    // >;
    // placeItem: QRL<
    //     (
    //         obj: MapObjWithPos,
    //         player: Player
    //     ) => boolean | Promise<boolean>
    // >;

    onServerAck: QRL<(msg: ServerAckMessage<ServerAckType>) => void>; 
    getPhysicsCollision: QRL<() => boolean>; 
    getPhysicsPrediction: QRL<() => boolean>; 
};
