import { RequestHandler } from "@builder.io/qwik-city";
import { WORLD_WRAPPER } from "~/server/serverState";
import { World } from "~/server/types";
import { PLAYER_IGNORED_KEYS, Player, WorldEntity } from "~/types/worldTypes";

// FIRST: need world state on server!
// for now: send entire worldstate to client? map, objects, players?
//
//
// generate a map, hardcode it for now
// also send objects? send players if there are players
//
//
// eventually want to generate map from a seed
// server generates map and sends seed to local
// local generates same map from seed
//
// or are maps simply going to be hardcoded... would be cool to generate more though

export const onGet: RequestHandler = async (reqEvent) => {
    // map objects are not serializable, convert to objects first
    const prepped: Omit<World<"Client">, "players" | "entities"> & {
        players: Record<string, Player>;
        entities: Record<string, WorldEntity>;
    } = {
        ...WORLD_WRAPPER.world,
        entities: Object.fromEntries(WORLD_WRAPPER.world.entities.entries()),
        players: Object.fromEntries(
            Array.from(WORLD_WRAPPER.world.players.entries()).filter(
                ([k]) => !PLAYER_IGNORED_KEYS.includes(k),
            ),
        ),
    };
    reqEvent.json(200, prepped);
};
