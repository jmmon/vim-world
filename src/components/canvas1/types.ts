
export type TileType = "grass" | "water" | "dirt" | "cliff";

export interface MapObject {
    type: "tree" | "box" | "chest" | "stone" | "cliff";
    pos: Vec2;
    walkable: boolean;
};

export interface Player {
    id: string;
    pos: Vec2;
    dir: "left" | "right" | "up" | "down";
    color: string;
};

export type World = {
    dimensions: {
        width: number;
        height: number;
        tileSize: number;
        canvasWidth: number;
        canvasHeight: number;
    }
    map: TileType[][];
    player: Player,
    otherPlayers: Player[],
    objects: MapObject[],
    help: {
        isOpen: boolean,
    }
}

export type Vec2 = {x: number, y: number;}
