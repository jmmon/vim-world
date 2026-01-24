import { $, Signal, component$, useSignal, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik"
import { Player } from "../canvas1/types";
import { stringToHash } from "../canvas1/utils";

export default component$(({ player }: { player: Signal<Player | null> }) => {
    const dialogRef = useSignal<HTMLDialogElement>();
    const username = useSignal<string>('');
    const storedHash = useSignal<number | null>(null);
    const MIN_LENGTH = 4;

    useStylesScoped$(`
    #choose-username {
        top: 50%;
        transform: translateY(-50%);
        padding: 2rem;
        margin: auto;
    }
    `);

    //eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        console.log('visibleTask runs');
        username.value = localStorage.getItem('playerName') ?? '';
        storedHash.value = localStorage.getItem('playerId') !== null ? parseInt(localStorage.getItem('playerId')!) : null;

        console.log({dialogRef});
        dialogRef.value?.show();
    });

    const onSubmit = $(async () => {
        try {
            let hash: number | null = null;
            if (username.value === '' || username.value.length < MIN_LENGTH) return;
            // had name stored in localStorage
            if (localStorage.getItem('playerName') !== null && username.value === localStorage.getItem('playerName')) {
                // use existing hash
                hash = storedHash.value!;
            } else {
                // generate new hash from user inputted name
                hash = stringToHash(username.value);
            }
            // TODO: server fetch/create player's character
            localStorage.setItem('playerName', username.value);
            localStorage.setItem('playerId', hash!.toString());
            const formData = new FormData();
            formData.append('name', username.value);
            formData.append('playerId', hash!.toString());
            const response = await fetch('http://localhost:3000/api/player', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            player.value = data;

            dialogRef.value!.close();
        } catch(err) {
            console.error(err);
        }
    });

    // need a wrapper div to mount component so visual task will run
    return (
        <div class="relative top-0 left-0 h-full w-full">
            <dialog id="choose-username" ref={dialogRef}>
                <div class="content flex flex-col gap-2">
                    <h2 class="text-2xl">Choose a username:</h2>
                    <p>This is unique for the character. Same name gets same character!</p>
                    <form
                        preventdefault:submit
                        id="username-form"
                        onSubmit$={onSubmit}
                        class="flex flex-col px-4 mt-4 gap-2"
                    >
                        <label for="username" >Username:</label>
                        <input
                            minLength={MIN_LENGTH}
                            maxLength={24}
                            autofocus
                            id="username"
                            class="border py-1 px-2"
                            placeholder="Enter Username"
                            type="text"
                            bind:value={username}
                        />

                        <button type="submit" class="mt-6 p-4 px-8 bg-blue-500">Submit</button>
                    </form>
                </div>
            </dialog>
        </div>
    )
})

