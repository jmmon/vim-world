import { QRL } from "@builder.io/qwik";
import { VimAction } from "~/fsm/types";
import { ServerWorld } from "~/server/types";
import { findObjectInRange } from "~/simulation/shared/interact";
import { MapObjWithItem, MapObject, Player, Vec2 } from "~/types/worldTypes";
import { ServerAckMessage, ServerAckType } from "~/types/messageTypes";

export interface Prediction {
    seq: number;
    action: VimAction;
    snapshotBefore: Player;
}

export type ClientData = {
    player?: Player; // not really needed??? but might be better to look up once only
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
    afkStartTime: number;
    idleStartTime: number;
    timeSinceLastCheckpoint: number;
    isDirty: {
        players: boolean;
        objects: boolean;
        map: boolean;
    };
    predictionBuffer: Prediction[];
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
    client: ClientData;
    isWithinBounds: QRL<(target: Vec2) => boolean>;
    isWalkable: QRL<(target: Vec2) => boolean>;
    addPlayer: QRL<(player: Player) => boolean>;
    initClientData: QRL<(data: InitializeClientData) => boolean>;
    getScaledTileSize: QRL<
        (desiredScale: number) => { actualScale: number; tileSize: number }
    >;
    rerender: QRL<() => void>;
    findObjectInRange: QRL<
        (player: Player) => ReturnType<typeof findObjectInRange>
    >;
    pickUpObject: QRL<(obj: MapObject, player: Player) => boolean>;
    pickUpItem: QRL<(obj: MapObjWithItem, player: Player) => boolean>;
    placeObject: QRL<
        (
            obj: MapObject,
            player: Player,
            target: Vec2,
        ) => boolean | Promise<boolean>
    >;
    onServerAck: QRL<(msg: ServerAckMessage<ServerAckType>) => void>; 
};
