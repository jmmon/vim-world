export type Direction = "N" | "S" | "E" | "W";
export type ObjectType = "tree" | "box" | "chest" | "stone" | "cliff" | "item";
export type ItemQuality = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type TileType = "GRASS" | "WATER" | "DIRT" | "CLIFF";
export type Tile = {
    type: TileType;
    collision?: Collision;
}




// e.g. this would replace MapObject so objects may contain things in the container
//   other ideas: "STATIC" | "ITEM" | "ACTOR" | "PROP";

type WorldEntityType = "ITEM_ENTITY" | "CHEST" | "NPC" | "PLAYER" | "TREE" | "BOX" | "STONE" | "CLIFF";
export interface WorldEntity {
    id: string;
    type: WorldEntityType;
    pos?: Vec2;

    collision?: Collision;
    container?: Container;
    liftable?: Liftable;
    interactable?: Interactable;
}
interface Collision {
  solid: boolean;
}
interface Container {
  capacity: number;
  itemIds: string[];
  behavior: "DESTROY_WHEN_EMPTY" | "PERSIST";
}
interface Interactable {
  selectors: string[]; // e.g. ["[", "]", "f", "F"]
  actions: InteractableAction[];
}
interface InteractableAction {
  type: "OPEN" | "PICK_UP" | "ACTIVATE" | "READ";
  condition?: "CONTAINER_NOT_EMPTY" | "CONTAINER_EMPTY";
}
interface Liftable {
  weight: number;
  canCarry: boolean;
}


export type Item = {
    id: string;
    kind: "SWORD" | "POTION" | "KEY";
    quality: ItemQuality;
    meta?: Record<"name" | "description" | string, any>;
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
    targetObj?: WorldEntity;
};
export type FindObjectsInRangeValid = FindObjectsInRange & {
    targetObj: WorldEntity;
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
