import { RequestHandler } from "@builder.io/qwik-city";
import { WORLD } from "~/server/serverState";

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
    // return just the map tiles?
    reqEvent.json(200, WORLD);
}
