import { ClientPhysicsMode } from "~/components/canvas1/constants";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { MapDimensions, Player, TileType, Vec2, WorldEntity } from "~/types/worldTypes";

export type ServerWorld = {
    dimensions: MapDimensions;
    map: TileType[][];
    walkable: TileType[]; // for collision
    players: Map<string, Player>;
    entities: Map<string, WorldEntity>,
};

export type ServerWorldWrapper = {
    world: ServerWorld,
    physics: ClientPhysicsMode;
    isWithinBounds(target: Vec2): boolean;
    isWalkable(target: Vec2): boolean;
    addPlayer(player: Player): boolean;
    findObjectInRangeByKey(player: Player, key: string): ReturnType<typeof findObjectInRangeByKey>;
    pickUpObject(obj: WorldEntity, player: Player): boolean;
    pickUpItem(obj: WorldEntity, player: Player): boolean;
    // placeObject(obj: MapObject, player: Player, target: Vec2): boolean | Promise<boolean>;
    // placeItem(obj: MapObjWithPos, player: Player): boolean | Promise<boolean>;
    getPhysicsCollision(): boolean;
    getPhysicsPrediction(): boolean;
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


