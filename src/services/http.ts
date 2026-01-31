import { API_PORT } from "~/components/canvas1/constants";
import { ServerWorld } from "~/server/types";
import { Player } from "~/types/worldTypes";

const httpService = {
    api: {
        player: async (formData: FormData) => {
            const response = await fetch(
                `http://localhost:${API_PORT}/api/player`,
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
                `http://localhost:${API_PORT}/api/map`,
            );
            return (await response.json()) as Omit<ServerWorld, "players"> & {
                players: Record<string, Player>;
            };
        },
    },
};
export default httpService;


