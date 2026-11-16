import { ExpandedVimAction } from "~/fsm/types";
import { TileEffect } from "~/server/map";

export type Direction = "N" | "S" | "E" | "W";

export type TileType = "GRASS" | "WATER" | "DIRT" | "CLIFF";
export type Tile = {
    type: TileType;
    collision?: Collision;
    /** ambient behaviour placed on this tile (e.g. a gale). Augments, doesn't rewrite type/collision. */
    effect?: TileEffect;
};

// e.g. this would replace MapObject so objects may contain things in the container
//  other ideas: "STATIC" | "ITEM" | "ACTOR" | "PROP";
//  | "NPC" | "PLAYER"

type WorldEntityType =
    | "ITEM_ENTITY"
    | "CHEST"
    | "TREE"
    | "BOX"
    | "STONE"
    | "CLIFF"
    | "DOOR"
    | "KEYHOLE"
    | "SPAWN";
export interface WorldEntity {
    /** e.g. `${type}-abcdefghijk` base58 11 chars, or a hand-authored id */
    id: string;
    type: WorldEntityType;
    pos?: Vec2;
    dir?: Direction;
    state?: EntityState;

    collision?: Collision;
    container?: Container;
    liftable?: Liftable;
    interactable?: Interactable;
    /**
     * linking: a KEYHOLE's `doorId` points at its DOOR; a DOOR's
     * `requiredKeyholeIds` lists the keyholes that must all be used to open it.
     * Only the relevant subset of fields is set per entity type.
     */
    lock?: Lock;
}
interface Collision {
    solid: boolean;
    /**
     * Whether a two-tile hop (`w`/`b`) may clear this obstacle. Only gaps set
     * it (`true`); every wall/barrier omits it, so `hoppable` defaults to
     * `false` — a solid obstacle is un-hoppable unless explicitly a gap.
     */
    hoppable?: boolean;
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
    conditions?: Array<
        | "CONTAINER_NOT_EMPTY"
        | "CONTAINER_EMPTY"
        | "NOT_LOCKED"
        | "IS_OPEN"
        | "IS_CLOSED"
    >;
}
interface Liftable {
    weight: number;
    canCarry: boolean;
}
interface Lock {
    /** KEYHOLE → the door this keyhole unlocks */
    doorId?: string;
    /** KEYHOLE → whether its matching key has been placed/used (commitment) */
    used?: boolean;
    /** DOOR → the keyholes that must all be used to open this door */
    requiredKeyholeIds?: string[];
}
type EntityState = DoorState | ChestState | KeyholeState | GenericState;

interface DoorState {
    kind: "DOOR";
    open: boolean;
    locked?: boolean;
}
interface KeyholeState {
    kind: "KEYHOLE";
    used: boolean;
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

export type ItemQualityId =
    | "COMMON"
    | "UNCOMMON"
    | "RARE"
    | "EPIC"
    | "LEGENDARY";
export type ItemKindId = "SWORD" | "POTION" | "KEY" | "SCROLL";
export type Item = {
    /** e.g. `${kind}-abcdefghijk` base58 11 chars */
    id: string;
    kind: ItemKindId;
    quality: ItemQualityId;
    meta?: Record<"name" | "description" | string, any>;
    /**
     * Lock group this item's key opens, bridging the global item (in
     * `objects.ts`'s `ITEMS`) to the map's link groups (`link: "a"` on the
     * chest/keyhole/door). Absent on non-key items. Enables multi-key: a second
     * KEY item with `link: "b"` opens a second lock with zero resolver changes.
     */
    link?: string;
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
}
export type CommandLineState = {
    buffer: string;
    bufferRaw: string;
    cursor: number;
    handleKey: (this: CommandLineState, key: string) => void;
    prompt: (this: CommandLineState) => void;
    reset: (this: CommandLineState) => void; 
}
export interface ServerPlayer extends Player {
    actionQueue: ExpandedVimAction[];
    commandLineState: CommandLineState;
    /** set when an action changed a synced entity (door/keyhole); the tick loop
     *  broadcasts it once and clears it. Transient — never serialized. */
    pendingWorldStateEntities?: WorldEntity[];
}
export const PLAYER_IGNORED_KEYS = ["actionQueue", "commandLineState", "pendingWorldStateEntities"];

export type SessionAggregate = {
    xpGained: number;
    goldGained: number;
    itemsAdded: string[];
    itemsRemoved: string[];
    achievementsUnlocked: string[];
};

type VecType = "local" | "chunk" | "world" | "pixels";
export type Vec2<T extends VecType = "world"> = T extends "local"
    ? {
          lx: number;
          ly: number;
      }
    : T extends "chunk"
      ? {
            cx: number;
            cy: number;
        }
      : T extends "pixels"
        ? {
              px: number;
              py: number;
          }
        : {
              x: number;
              y: number;
          };

export interface FindObjectsInRange {
    modifiedRange: number;
    dir: Direction;
    pos: Vec2;
}
export interface FindObjectsInRangeError extends FindObjectsInRange {
    obj?: WorldEntity;
}
export interface FindObjectsInRangeValid extends FindObjectsInRange {
    obj: WorldEntity;
}
export type FindObjectsInRangeResult =
    | FindObjectsInRangeError
    | FindObjectsInRangeValid;
