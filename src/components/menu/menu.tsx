import {
    component$,
    useSignal,
    $,
    useTask$,
    isServer,
    sync$,
} from "@builder.io/qwik";
import { LocalWorldWrapper } from "../canvas1/types";
import { roundToDecimals } from "~/utils/utils";

export default component$(({ state }: { state: LocalWorldWrapper }) => {
    const dialogRef = useSignal<HTMLDialogElement>();
    const inputRef = useSignal<HTMLInputElement>();
    const scale = useSignal(state.world.dimensions.scale);

    useTask$(({ track }) => {
        const isOpen = track(() => state.show.menu);
        if (isServer) return;
        if (isOpen === dialogRef.value?.open) return;

        if (isOpen) {
            dialogRef.value?.show();
            inputRef.value?.focus();
        } else {
            dialogRef.value?.close();
        }
    });

    const onSubmit = $(async () => {
        const { actualScale, tileSize } = await state.getScaledTileSize(
            scale.value,
        );
        if (actualScale !== state.world.dimensions.scale) {
            await state.updateScale(actualScale, tileSize);
            state.markAllDirty();
        }
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
                        <label for="scale">
                            Scale: {roundToDecimals(scale.value * 100, 3)}%
                        </label>
                        <input
                            ref={inputRef}
                            type="range"
                            min={0.5}
                            max={2}
                            step={1 / 32}
                            bind:value={scale}
                            onKeyDown$={sync$((e: KeyboardEvent) => {
                                // really I should be piping in the FSM keybinds and handlers instead of doing separate keydown events...
                                e.preventDefault();
                                if (
                                    e.key === "l" ||
                                    e.key === "h" ||
                                    e.key === "j" ||
                                    e.key === "k" ||
                                    e.key === "Enter" ||
                                    (e.ctrlKey && e.key === "[")
                                ) {
                                    // allow
                                    console.log(e);
                                    switch (e.key) {
                                        case "l":
                                        case "k":
                                            scale.value += 1 / 32;
                                            inputRef.value!.value =
                                                scale.value.toString();
                                            break;
                                        case "h":
                                        case "j":
                                            scale.value -= 1 / 32;
                                            inputRef.value!.value =
                                                scale.value.toString();
                                            break;
                                        case "Enter":
                                            onSubmit();
                                            break;
                                        case "[":
                                            if (state.show.menu)
                                                state.show.menu = false;
                                            break;
                                    }
                                }
                            })}
                        />

                        <button type="submit" class="mt-6 bg-blue-500 p-4 px-8">
                            Apply
                        </button>
                    </form>
                </div>
            </dialog>
        </>
    );
});
