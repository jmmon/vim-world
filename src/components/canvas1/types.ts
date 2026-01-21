
export type TileType = "grass" | "water" | "dirt" | "cliff";

export interface MapObject {
    type: "tree" | "box" | "chest" | "stone" | "cliff";
    pos: Vec2;
    walkable: boolean;
};

export interface Player {
    id: string;
    pos: Vec2;
    // dir: "left" | "right" | "up" | "down";
    dir: 'N' | 'S' | 'E' | 'W';
    color: string;
};

export type MapDimensions = {
    width: number;
    height: number;
    tileSize: number;
    canvasWidth: number;
    canvasHeight: number;
}
export type World = {
    dimensions: MapDimensions;
    map: TileType[][];
    player: Player,
    otherPlayers: Player[],
    objects: MapObject[],
    walkable: TileType[],
    help: {
        isOpen: boolean,
    }
}

export type Vec2 = {x: number, y: number;}
