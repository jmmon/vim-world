import { MAP_CONFIG, zone } from "~/server/map";
import { ClientSession, ServerWorldWrapper, World, ClientPlayerCacheData } from "./types";
import { Player, ServerPlayer } from "~/types/worldTypes";
import { isWalkable, isWithinBounds, spiralSearch } from "~/simulation/shared/helpers";
import { entities } from "./objects";
import { getServerPhysics } from "~/simulation/shared/physics";
import { initCommandLineState } from "~/simulation/shared/actions/command";

export const clients = new Map<string, ClientSession | ClientPlayerCacheData>();
const players = new Map<string, ServerPlayer>();

export const SERVER_WORLD: World<'Server'> = {
    zone: zone,
    players,
    entities: entities,
    config: MAP_CONFIG,
}

export const serverhandlers = {
    addPlayer(ctx: ServerWorldWrapper, player: Player) {
        if (!player) return false;
        try {
            // shift pos if not walkable
            spiralSearch(
                player.pos,
                128,
                (pos) => isWithinBounds(ctx, pos) && isWalkable(ctx, pos)
            );

            const serverPlayer: ServerPlayer = {
                ...player,
                actionQueue: [],
                commandLineState: initCommandLineState(),
            };
            ctx.world.players.set(player.id, serverPlayer);
            console.log('added player:', player);
            return true;
        } catch(err) {
            console.error('addPlayer error:', err);
            return false;
        }
    },
    getPlayerById(ctx: ServerWorldWrapper, playerId?: string) {
        if (!playerId) return undefined;
        return ctx.world.players.get(playerId);
    },
}

export const WORLD_WRAPPER: ServerWorldWrapper = {
    world: SERVER_WORLD,
    physics: getServerPhysics(),
};
