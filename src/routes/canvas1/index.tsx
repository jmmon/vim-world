import { Resource, component$, useResource$ } from "@builder.io/qwik";
import Canvas1 from "~/components/canvas1/canvas1";
import { Player } from "~/components/canvas1/types";
import { ServerWorld } from "~/server/types";
import httpService from "~/services/http";

export default component$(() => {
    // fetch world from server
    const world = useResource$<ServerWorld>(async () => {
        const serverWorld = await httpService.api.map();

        console.assert((!serverWorld.players.has), "serverWorld:", serverWorld, '\ntypeof players:', typeof serverWorld.players);
        const rebuiltWorld: ServerWorld = {
            ...serverWorld,
            players: new Map<string, Player>(
                Object.entries(serverWorld.players),
            ),
        };
        console.assert(!!rebuiltWorld.players.has, "rebuiltWorld:", rebuiltWorld, '\ntypeof players:', typeof rebuiltWorld.players, '\nMissing .has property');
        return rebuiltWorld;
    });

    // pending indicator never shows, unless resource is tracking some state
    return (
        <Resource
            value={world}
            onPending={() => (
                <div class="flex h-full w-full items-center justify-center">
                    <p class="text-3xl">Loading...</p>
                </div>
            )}
            onResolved={(serverWorld) => <Canvas1 worldState={serverWorld} />}
        />
    );
});
