import { component$, useSignal, $, useTask$, isServer } from "@builder.io/qwik";
import { LocalWorldWrapper } from "../canvas1/types";

export default component$(
    ({ state }: { state: LocalWorldWrapper }) => {
        const dialogRef = useSignal<HTMLDialogElement>();
        const scale = useSignal(state.world.dimensions.scale);

        useTask$(({ track }) => {
            const isOpen = track(() => state.show.menu);
            if (isServer) return;
            if (isOpen === dialogRef.value?.open) {
                return console.log("localWorld.isOpen matches actual state");
            }

            if (isOpen) {
                dialogRef.value?.show();
            } else {
                dialogRef.value?.close();
            }
        });

        const onSubmit = $(async () => {
            const { actualScale, tileSize } =
                await state.getScaledTileSize(scale.value);
            state.world.dimensions.scale = actualScale;
            state.world.dimensions.tileSize = tileSize;
            state.world.dimensions.canvasWidth =
                tileSize * state.world.dimensions.width;
            state.world.dimensions.canvasHeight =
                tileSize * state.world.dimensions.height;
            state.rerender();
            state.show.menu = false;
        });

        return (
            <>
                <div class="absolute top-0 left-0 h-0 w-0"></div>
                <dialog
                    class="top-[50%] m-auto translate-y-[-50%] p-8"
                    ref={dialogRef}
                >
                    <div class="flex flex-col gap-2">
                        <h2 class="mx-auto text-2xl">Menu</h2>
                        <form
                            onSubmit$={onSubmit}
                            preventdefault:submit
                            class="mt-4 flex flex-col gap-2 px-4"
                        >
                            <label for="scale">Scale:</label>
                            <input
                                type="range"
                                min={0.5}
                                max={2}
                                step={1 / 32}
                                bind:value={scale}
                            />

                            <button
                                type="submit"
                                class="mt-6 bg-blue-500 p-4 px-8"
                            >
                                Apply
                            </button>
                        </form>
                    </div>
                </dialog>
            </>
        );
    },
);


