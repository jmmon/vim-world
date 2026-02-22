import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { MapDimensions, Player, Vec2, WorldEntity } from "~/types/worldTypes";
import { Zone } from "./map";
import { PhysicsMode } from "./physics";

export type World = {
    players: Map<string, Player>;
    entities: Map<string, WorldEntity>,
    zone: Zone;
    dimensions: MapDimensions;  // derived/merged with MapConfig?
};

export type ServerWorldWrapper = {
    world: World,
    physics: PhysicsMode;
    isWithinBounds(target: Vec2): boolean;
    isWalkable(target: Vec2): boolean;
    addPlayer(player: Player): boolean;
    findObjectInRangeByKey(player: Player, key: string): ReturnType<typeof findObjectInRangeByKey>;
    pickUpObject(obj: WorldEntity, player: Player): boolean;
    pickUpItem(obj: WorldEntity, player: Player): boolean;
    // placeObject(obj: MapObject, player: Player, target: Vec2): boolean | Promise<boolean>;
    // placeItem(obj: MapObjWithPos, player: Player): boolean | Promise<boolean>;
}

export type ClientData<T extends undefined | 'withPlayerId' = undefined> = {
    clientId: string;
    ws: any;
    lastMessageTime: number;
    isAfk: boolean;
    playerId: T extends 'withPlayerId' ? string : undefined;
    reset: () => void;
    disconnect: () => void;
};


