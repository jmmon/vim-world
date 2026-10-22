import { World } from "~/server/types";
import { Player, WorldEntity } from "~/types/worldTypes";
import { apiOrigin } from "./origin";

export type SerializableClientWorld = Omit<World<'Client'>, "players" | "entities"> & {
    players: Record<string, Player>;
    entities: Record<string, WorldEntity>;
};

const httpService = {
    api: {
        player: async (formData: FormData) => {
            const response = await fetch(
                `${apiOrigin()}/api/player`,
                {
                    method: "POST",
                    body: formData,
                },
            );
            return (await response.json()) as {
                player: Player;
                isNew: boolean;
            };
        },
        map: async () => {
            const response = await fetch(
                `${apiOrigin()}/api/map`,
            );
            return (await response.json()) as SerializableClientWorld;
        },
    },
};
export default httpService;
