import { SessionAggregate } from "~/server/types";

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

export type Vec2 = {
    x: number;
    y: number;
};


