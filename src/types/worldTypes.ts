export type Direction = "N" | "S" | "E" | "W";
export type TileType = "grass" | "water" | "dirt" | "cliff";
export type ObjectType = "tree" | "box" | "chest" | "stone" | "cliff" | "item";
export type ItemQuality = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface MapObject {
    type: ObjectType;
    target?: string;
    pos: Vec2;
    walkable: boolean;
    itemIds?: string[]; // lootable
    liftable: boolean;
};

export type Item = {
    id: string;
    type: string;
    quality: ItemQuality;
    name: string;
    description: string;
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

export type SessionAggregate = {
    xpGained: number;
    goldGained: number;
    itemsAdded: string[];
    itemsRemoved: string[];
    achievementsUnlocked: string[];
}


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


