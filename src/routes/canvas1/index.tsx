import { Resource, component$, useResource$ } from "@builder.io/qwik";
import Canvas1 from "~/components/canvas1/canvas1";
import { API_PORT } from "~/components/canvas1/constants";
import { World } from "~/components/canvas1/types";


export default component$(() => {
    const world = useResource$<World>(async () => {
        const response = await fetch(`http://localhost:${API_PORT}/api/map`);
        const data = await response.json();
        return data;
    });

    // pending indicator never shows, unless resource is tracking some state
    return (
        <Resource
            value={world}
            onPending={() => <div class="w-full h-full flex items-center justify-center"><p class="text-3xl">Loading...</p></div>}
            onResolved={(world) => <Canvas1 world={world}/>}
        />
    );
});
