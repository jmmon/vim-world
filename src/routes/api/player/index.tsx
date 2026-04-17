import { RequestHandler } from "@builder.io/qwik-city";
import checkpointService from "~/server/checkpointService";
import { WORLD_WRAPPER, serverhandlers } from "~/server/serverState";

export const onPost: RequestHandler = async (requestEvent) => {
    const formData: FormData = await requestEvent.request.formData();

    const playerId = formData.get("playerId");
    if (playerId === null || playerId === "" || playerId instanceof File) {
        requestEvent.json(400, { message: `missing/invalid playerId` });
        return;
    }
    const name = formData.get("name");
    if (name instanceof File) {
        requestEvent.json(400, { message: `invalid name` });
        return;
    }

    const { checkpoint, isNew } = checkpointService.loadOrDefault(
        playerId,
        name,
    );
    const player = checkpointService.toPlayer(checkpoint);

    const added = serverhandlers.addPlayer(WORLD_WRAPPER, player);
    if (!added) {
        requestEvent.json(400, { message: "Error instantiating player" });
        return;
    }
    // return player object
    requestEvent.json(200, { player, isNew });
};
