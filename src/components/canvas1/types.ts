import { ExpandedVimAction, VimAction } from "~/fsm/types";
import { Player, Vec2 } from "~/types/worldTypes";
import { PhysicsMode } from "~/simulation/shared/physics";
import { PlayerCheckpoint } from "~/server/checkpointService";
import useDispatch$ from "~/hooks/useDispatch";
import { World } from "~/server/types";
import { ReasonCorrection, ReasonInvalid } from "~/simulation/server/types";
import { NoSerialize } from "@builder.io/qwik";
import { VimFSM } from "~/fsm/fsm";

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
export type ActionResult = {
    isDirty: ApplyActionDirtyResult
    reason?: ReasonCorrection | ReasonInvalid | undefined | "UNHANDLED";
};
export type ApplyActionDirtyResult = Partial<IsDirty> | boolean;
export type MaybePromise<T> = T | Promise<T>;

export type Viewport = {
    origin: Vec2,
    width: number; // px
    height: number; // px
};
export type VimSettings = {
    sidescrolloff: number,
    scrolloff: number,
    lines: number,
    columns: number,
};

export type ClientData = {
    fsm: NoSerialize<VimFSM>;
    isReady: boolean;
    lastInit: number;
    settings: VimSettings;
    player?: Player;
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
    afkStartTime: number;
    idleStartTime: number;
    timeSinceLastCheckpoint: number;
    isDirty: IsDirty;
    inputBuffer: Prediction[];
    actionQueue: ExpandedVimAction[];
    tick: number;
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

export type Refs = {
    offscreenMap: HTMLCanvasElement;
    map: HTMLCanvasElement;
    objects: HTMLCanvasElement;
    players: HTMLCanvasElement;
    overlay: HTMLCanvasElement;
};

export type LocalWorldWrapper = InterfaceData & {
    world: World<'Client'>;
    client: ClientData;
    physics: PhysicsMode;
    // isWithinBounds: QRL<(target: Vec2) => boolean>;
    // isWalkable: QRL<(target: Vec2) => boolean>;
    // initClientData: QRL<(data: InitializeClientData) => boolean>;
    // getScaledTileSize: QRL<
    //     (desiredScale: number) => { actualScale: number; tileSize: number }
    // >;
    // markAllDirty: QRL<() => void>;
    // clearAllDirty: QRL<() => void>;
    // updateScale: QRL<(newScale: number, newTileSize: number) => void>;
    // findObjectInRangeByKey: QRL<
    //     (player: Player, key: string) => ReturnType<typeof findObjectInRangeByKey>
    // >;
    // pickUpObject: QRL<(obj: WorldEntity, player: Player) => boolean>;
    // pickUpItem: QRL<(obj: WorldEntity, player: Player) => boolean>;

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

    // handleComparePrediction: QRL<(result: Player, predictionIndex: number, authoritativeState?: Partial<Player>, ) => boolean>;
    // handleAckSubtype: QRL<(msg: ServerAckMessage<SubtypeServerAck>) => void>;
    // onServerAck: QRL<(msg: ServerAckMessage<SubtypeServerAck>) => void>; 
    // onOtherPlayerMove: QRL<(msg: ServerOtherPlayerMessage<"MOVE">) => void>;
    // playerSnapshot:QRL<(player?: Player) => Player>;
    // onInitConfirm: QRL<(data: ServerInitConfirmMessage) => void>;
    // updateViewportDimensions: QRL<() => boolean>;
    // updateIsDirty: QRL<(isDirty: MaybePromise<ApplyActionDirtyResult>) => void>;
    // applyActionStep: QRL<(action: VimAction, tick: number) => Promise<ReasonCorrection | ReasonInvalid | undefined>>;
    dispatch: ReturnType<typeof useDispatch$>;
};
