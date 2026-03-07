import { QRL } from "@builder.io/qwik";
import { VimAction } from "~/fsm/types";
import { World } from "~/server/types";
import { ServerAckMessage, SubtypeServerAck } from "~/types/wss/server";
import { Player, Vec2, WorldEntity } from "~/types/worldTypes";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { PhysicsMode } from "~/simulation/shared/physics";

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
export type ApplyActionDirtyResult = Partial<IsDirty> | boolean;
export type MaybePromise<T> = T | Promise<T>;

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
        helpHint: boolean;
        menu: boolean;
        afk: boolean;
        devStats: boolean;
    };
};

export type LocalWorldWrapper = InterfaceData & {
    world: World & {
        lastScale: number;
    };
    client: ClientData;
    physics: PhysicsMode;
    isWithinBounds: QRL<(target: Vec2) => boolean>;
    isWalkable: QRL<(target: Vec2) => boolean>;
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

    onServerAck: QRL<(msg: ServerAckMessage<SubtypeServerAck>) => void>; 
};
