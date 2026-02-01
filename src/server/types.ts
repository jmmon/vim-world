import { findObjectInRange } from "~/simulation/shared/interact";
import { MapDimensions, MapObjWithItem, MapObject, Player, TileType, Vec2 } from "~/types/worldTypes";

export type ServerWorld = {
    dimensions: MapDimensions;
    map: TileType[][];
    walkable: TileType[]; // for collision
    players: Map<string, Player>;
    objects: MapObject[],
};

export type ServerWorldWrapper = {
    world: ServerWorld,
    isWithinBounds(target: Vec2): boolean;
    isWalkable(target: Vec2): boolean;
    addPlayer(player: Player): boolean;
    findObjectInRange(player: Player): ReturnType<typeof findObjectInRange>;
    pickUpObject(obj: MapObject, player: Player): boolean;
    pickUpItem(obj: MapObjWithItem, player: Player): boolean;
    placeObject(obj: MapObject, player: Player, target: Vec2): boolean | Promise<boolean>;
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


