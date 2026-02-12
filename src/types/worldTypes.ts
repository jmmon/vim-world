export type Direction = "N" | "S" | "E" | "W";

export type TileType = "GRASS" | "WATER" | "DIRT" | "CLIFF";
export type Tile = {
    type: TileType;
    collision?: Collision;
}


// e.g. this would replace MapObject so objects may contain things in the container
//  other ideas: "STATIC" | "ITEM" | "ACTOR" | "PROP";
//  | "NPC" | "PLAYER"

type WorldEntityType = "ITEM_ENTITY" | "CHEST"  | "TREE" | "BOX" | "STONE" | "CLIFF" | "DOOR";
export interface WorldEntity {
    id: string;
    type: WorldEntityType;
    pos?: Vec2;
    dir?: Direction;
    state?: EntityState;

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
  type: "OPEN" | "CLOSE" | "TOGGLE" | "PICK_UP" | "ACTIVATE" | "READ";
  conditions?: Array<"CONTAINER_NOT_EMPTY" | "CONTAINER_EMPTY" | "NOT_LOCKED" | "IS_OPEN" | "IS_CLOSED">;
}
interface Liftable {
  weight: number;
  canCarry: boolean;
}
type EntityState =
    | DoorState
    | ChestState
    | GenericState;

interface DoorState {
    kind: "DOOR";
    open: boolean;
    locked?: boolean;
}
interface ChestState {
    kind: "CHEST";
    open: boolean;
    locked?: boolean;
}
interface GenericState {
    kind: "CHEST";
    open: boolean;
    locked?: boolean;
}




export type ItemQualityId = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type ItemKindId = "SWORD" | "POTION" | "KEY" | 'SCROLL' ;
export type Item = {
    id: string;
    kind: ItemKindId;
    quality: ItemQualityId;
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


export interface FindObjectsInRange {
    modifiedRange: number;
    dir: Direction;
    lastPosBeforeObject: Vec2;
};
export interface FindObjectsInRangeError extends FindObjectsInRange {
    targetObj?: WorldEntity;
};
export interface FindObjectsInRangeValid extends FindObjectsInRange {
    targetObj: WorldEntity;
};
export type FindObjectsInRangeResult = FindObjectsInRangeError | FindObjectsInRangeValid;


