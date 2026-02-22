import { RequestHandler } from "@builder.io/qwik-city";
import checkpointService from "~/server/checkpointService";
import { WORLD_WRAPPER } from "~/server/serverState";

export const onPost: RequestHandler = async (requestEvent) => {
    // TODO: zod
    const formData: FormData = await requestEvent.request.formData();

    const { checkpoint, isNew } = checkpointService.loadOrDefault(formData.get('playerId') as string);
    const player = checkpointService.toPlayer({
        ...checkpoint,
        name: formData.get('name') as string,
    });

    const added = await WORLD_WRAPPER.addPlayer(player);
    if (!added) {
        requestEvent.json(400, { message: 'Error instantiating player', });
        return;
    }
    // return player object
    requestEvent.json(200, { player, isNew });
}


