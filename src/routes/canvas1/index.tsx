import { Resource, component$, useResource$ } from "@builder.io/qwik";
import Canvas1 from "~/components/canvas1/canvas1";
import { Player, WorldEntity } from "~/types/worldTypes";
import { World } from "~/server/types";
import httpService from "~/services/http";

export default component$(() => {
    // fetch world from server
    const worldResource = useResource$<World>(async () => {
        const serverWorld = await httpService.api.map();

        console.assert((!serverWorld.players.has), "serverWorld:", serverWorld, '\ntypeof players:', typeof serverWorld.players);
        const rebuiltWorld: World = {
            ...serverWorld,
            players: new Map<string, Player>(
                Object.entries(serverWorld.players),
            ),
            entities: new Map<string, WorldEntity>(
                Object.entries(serverWorld.entities),
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
            onResolved={(serverWorld) => <Canvas1 worldState={serverWorld} />}
        />
    );
});


