import { RequestHandler } from "@builder.io/qwik-city";
import checkpointService from "~/server/checkpointService";
import { WORLD_WRAPPER } from "~/server/serverState";

export const onPost: RequestHandler = async (requestEvent) => {
    const formData = (await requestEvent.request.formData()) as FormData;
    // look up or create player
    // e.g. load from checkpoint????
    //
    const { checkpoint, isNew } = checkpointService.loadOrDefault(formData.get('playerId') as string);
    const player = checkpointService.toPlayer({
        ...checkpoint,
        name: formData.get('name') as string,
    });

    WORLD_WRAPPER.addPlayer(player);
    // return player object
    requestEvent.json(200, { player, isNew });
}

