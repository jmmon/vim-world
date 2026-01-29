import {
    $,
    Signal,
    component$,
    useSignal,
    useVisibleTask$,
} from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import crypto from "node:crypto";
import httpService from "~/services/http";
import { InitializeClientData } from "../canvas1/types";

const serverHash$ = server$((str: string) =>
    crypto.createHash("sha256").update(str).digest("hex"),
);

export default component$(
    ({
        initializeSelfData,
    }: {
        initializeSelfData: Signal<InitializeClientData | undefined>;
    }) => {
        const dialogRef = useSignal<HTMLDialogElement>();
        const username = useSignal<string>("");
        const storedHash = useSignal<string | null>(null);
        const MIN_LENGTH = 4;

        //eslint-disable-next-line qwik/no-use-visible-task
        useVisibleTask$(() => {
            username.value = localStorage.getItem("playerName") ?? "";
            storedHash.value =
                localStorage.getItem("playerId") !== null
                    ? localStorage.getItem("playerId")!
                    : null;

            dialogRef.value?.show();
        });

        const onSubmit = $(async () => {
            try {
                let hash: string | null = null;
                if (username.value === "" || username.value.length < MIN_LENGTH)
                    return;

                if (
                    localStorage.getItem("playerName") !== null &&
                    username.value === localStorage.getItem("playerName")
                ) {
                    hash = storedHash.value!;
                } else {
                    hash = await serverHash$(username.value);
                }

                localStorage.setItem("playerName", username.value);
                localStorage.setItem("playerId", hash);
                const formData = new FormData();
                formData.append("name", username.value);
                formData.append("playerId", hash);

                const { player, isNew } =
                    await httpService.api.player(formData);
                console.log("/api/player response:", { player, isNew });

                initializeSelfData.value = {
                    player: player,
                    username: username.value,
                    usernameHash: hash,
                };
                // player.value = loadedPlayer;

                dialogRef.value!.close();
            } catch (err) {
                console.error(err);
            }
        });

        // need a wrapper div to mount component so visual task will run
        return (
            <>
                <div class="absolute top-0 left-0 h-0 w-0"></div>
                <dialog
                    ref={dialogRef}
                    class="top-[50%] m-auto translate-y-[-50%] p-8"
                >
                    <div class="content flex flex-col gap-2">
                        <h2 class="text-2xl">Choose a username:</h2>
                        <p>
                            This is unique for the character. Same name gets
                            same character!
                        </p>
                        <form
                            onSubmit$={onSubmit}
                            preventdefault:submit
                            id="username-form"
                            class="mt-4 flex flex-col gap-2 px-4"
                        >
                            <label for="username">Username:</label>
                            <input
                                minLength={MIN_LENGTH}
                                maxLength={24}
                                autofocus
                                id="username"
                                class="border px-2 py-1"
                                placeholder="Enter Username"
                                type="text"
                                bind:value={username}
                            />

                            <button
                                type="submit"
                                class="mt-6 bg-blue-500 p-4 px-8"
                            >
                                Submit
                            </button>
                        </form>
                        <button
                            onClick$={() => {
                                localStorage.removeItem("playerName");
                                localStorage.removeItem("playerId");
                            }}
                            type="button"
                            class="bg-red-500 p-4 px-8"
                        >
                            Clear LocalStorage
                        </button>
                    </div>
                </dialog>
            </>
        );
    },
);
