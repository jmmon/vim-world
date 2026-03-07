// import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { Player, ServerPlayer, WorldEntity } from "~/types/worldTypes";
import { MapConfig, Zone } from "./map";
import { PhysicsMode } from "../simulation/shared/physics";

export type World<T extends 'Server' | 'Client' | undefined = undefined> = {
    entities: Map<string, WorldEntity>,
    zone: Zone;
    config: MapConfig;
} & (T extends 'Server' | 'Client' ? {
    players: Map<string, T extends 'Server' ? ServerPlayer : Player>;
} : {});
// export interface ServerWorld extends World {
//     players: Map<string, ServerPlayer>;
// }
// export interface ClientWorld extends World {
//     players: Map<string, Player>;
// }

export type ServerWorldWrapper = {
    world: World<'Server'>,
    physics: PhysicsMode;
    // maybe I want to move all of these out of this object,
    // pass in state to each,
    // then they can all be sync on client and server
    // addPlayer(player: Player): Promise<boolean>;
    // getPlayerById(playerId?: string): ServerPlayer | undefined;
    // findObjectInRangeByKey(player: Player, key: string): ReturnType<typeof findObjectInRangeByKey>;
    // pickUpObject(obj: WorldEntity, player: Player): boolean;
    // pickUpItem(obj: WorldEntity, player: Player): boolean;
    // placeObject(obj: MapObject, player: Player, target: Vec2): boolean | Promise<boolean>;
    // placeItem(obj: MapObjWithPos, player: Player): boolean | Promise<boolean>;
}

export interface ClientSession {
    clientId: string;
    ws: any;
    lastMessageTime: number;
    isAfk: boolean;
    reset: () => void;
    disconnect: () => void;
    callTicks?: (ts: number, tick: number) => void;
    playerId?: string;
}

export interface ClientPlayerCacheData extends ClientSession {
    playerId: string;
};

