import { QRL } from "@builder.io/qwik";
import { GameAction } from "~/fsm/types";
import { ServerWorld, SessionAggregate } from "~/server/types";

export type Direction = "N" | "S" | "E" | "W";
export type TileType = "grass" | "water" | "dirt" | "cliff";

export interface MapObject {
    type: "tree" | "box" | "chest" | "stone" | "cliff";
    pos: Vec2;
    walkable: boolean;
};

export interface Player {
    name: string;
    id: string;
    pos: Vec2;
    dir: Direction;
    color: string;
    zone: string;
    lastProcessedSeq: number;
    session: SessionAggregate;
};

export type MapDimensions = {
    width: number;
    height: number;
    tileSize: number;
    canvasWidth: number;
    canvasHeight: number;
    scale: number;
}
export type World = {
    dimensions: MapDimensions;
    map: TileType[][];
    player: Player,
    players: Map<string, Player>,
    objects: MapObject[],
    walkable: TileType[],
    help: {
        isOpen: boolean,
    }
}

export type Vec2 = {x: number, y: number;}

export interface Prediction {
    seq: number;
    action: GameAction;
    snapshotBefore: Player;
}

export type ClientData = {
    player?: Player; // not really needed??? but might be better to look up once only
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
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
    };
};
export type LocalWorldWrapper = {
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
} & InterfaceData;
