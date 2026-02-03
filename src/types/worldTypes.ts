export type Direction = "N" | "S" | "E" | "W";
export type TileType = "grass" | "water" | "dirt" | "cliff";
export type ObjectType = "tree" | "box" | "chest" | "stone" | "cliff" | "item";
export type ItemQuality = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface MapObject {
    id: string;
    type: ObjectType;
    keys?: string;
    pos?: Vec2;
    walkable: boolean;
    itemIds?: string[]; // lootable
    liftable: boolean;
};
export interface MapObjWithItem extends MapObject {
    itemIds: string[];
}
export interface MapObjWithPos extends MapObject {
    pos: Vec2;
}


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
    level: number;
    itemIds?: string[];
    carryingObjId?: string;
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


export type FindObjectsInRange = {
    modifiedRange: number;
    dir: Direction;
    lastPosBeforeObject: Vec2;
};
export type FindObjectsInRangeError = FindObjectsInRange & {
    targetObj?: MapObjWithPos;
};
export type FindObjectsInRangeValid = FindObjectsInRange & {
    targetObj: MapObjWithPos;
};
export type FindObjectsInRangeResult = FindObjectsInRangeError | FindObjectsInRangeValid;


// export type FindObjectsInRangeResult<T extends MapObjWithPos | undefined = MapObjWithPos> = {
//     modifiedRange: number;
//     dir: Direction;
//     lastPosBeforeObject: Vec2;
// } & T extends MapObjWithPos ? {
//     targetObj: T;
// } : {
//     targetObj?: T;
// };
