import { QRL } from "@builder.io/qwik";
import { VimAction } from "~/fsm/types";
import { World } from "~/server/types";
import { ServerAckMessage, ServerInitConfirmMessage, ServerOtherPlayerMessage, SubtypeServerAck } from "~/types/wss/server";
import { Player, Vec2, WorldEntity } from "~/types/worldTypes";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { PhysicsMode } from "~/simulation/shared/physics";
import { PlayerCheckpoint } from "~/server/checkpointService";
import useDispatch$ from "~/hooks/useDispatch";

export interface Prediction {
    seq: number;
    action: VimAction;
    snapshotBefore: Player;
}
export type IsDirty = {
    overlay: boolean,
    players: boolean,
    objects: boolean,
    map: boolean,
};
export type ApplyActionDirtyResult = Partial<IsDirty> | boolean;
export type MaybePromise<T> = T | Promise<T>;

export type Viewport = {
    origin: Vec2,
    width: number; // px
    height: number; // px
}
export type VimSettings = {
    sidescrolloff: number,
    scrolloff: number,
    lines: number,
    columns: number,
}

export type ClientData = {
    settings: VimSettings;
    player?: Player;
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
    lastAckCheckpoint?: PlayerCheckpoint;
    viewport: Viewport;
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
    world: World;
    client: ClientData;
    physics: PhysicsMode;
    isWithinBounds: QRL<(target: Vec2) => boolean>;
    isWalkable: QRL<(target: Vec2) => boolean>;
    initClientData: QRL<(data: InitializeClientData) => boolean>;
    getScaledTileSize: QRL<
        (desiredScale: number) => { actualScale: number; tileSize: number }
    >;
    markAllDirty: QRL<() => void>;
    clearAllDirty: QRL<() => void>;
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
    onOtherPlayerMove: QRL<(msg: ServerOtherPlayerMessage<"MOVE">) => void>;
    onInitConfirm: QRL<(data: ServerInitConfirmMessage) => void>;
    updateViewportDimensions: QRL<() => boolean>;
    updateIsDirty: QRL<(isDirty: ApplyActionDirtyResult) => void>;
    dispatch: ReturnType<typeof useDispatch$>;
};
