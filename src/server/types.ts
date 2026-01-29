import { MapDimensions, MapObject, Player, TileType, Vec2 } from "~/components/canvas1/types";

export type Item = any;
export type ItemId = string;
export type SessionAggregate = {
    xpGained: number;
    goldGained: number;
    itemsAdded: Item[];
    itemsRemoved: ItemId[];
    achievementsUnlocked: string[];
}

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
