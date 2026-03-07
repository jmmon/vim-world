import { Resource, component$, useResource$ } from "@builder.io/qwik";
import Canvas1 from "~/components/canvas1/canvas1";
import { Player, WorldEntity } from "~/types/worldTypes";
import httpService from "~/services/http";
import { World } from "~/server/types";

export default component$(() => {
    // fetch world from server
    const worldResource = useResource$<World<'Client'>>(async () => {
        const clientWorld = await httpService.api.map();

        console.assert((!clientWorld.players.has), "serverWorld:", clientWorld, '\ntypeof players:', typeof clientWorld.players);
        const rebuiltWorld: World<'Client'> = {
            ...clientWorld,
            players: new Map<string, Player>(
                Object.entries(clientWorld.players),
            ),
            entities: new Map<string, WorldEntity>(
                Object.entries(clientWorld.entities),
            ),
        };
        console.assert(!!rebuiltWorld.players.has, "rebuiltWorld:", rebuiltWorld, '\ntypeof players:', typeof rebuiltWorld.players, '\nMissing .has property');
        console.assert(!!rebuiltWorld.entities.has, "rebuiltWorld:", rebuiltWorld, '\ntypeof entities:', typeof rebuiltWorld.entities, '\nMissing .has property');
        console.log({rebuiltWorld});
        return rebuiltWorld;
    });

    // pending indicator never shows, unless resource is tracking some state
    return (
        <Resource
            value={worldResource}
            onPending={() => (
                <div class="flex h-full w-full items-center justify-center">
                    <p class="text-3xl">Loading...</p>
                </div>
            )}
            onResolved={(clientWorld) => <Canvas1 worldState={clientWorld} />}
        />
    );
});


