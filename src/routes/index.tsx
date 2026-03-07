import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import Inventory from "~/components/inventory/inventory";

export default component$(() => {
    return (
        <div class="p-16 flex flex-col gap-4">
            <nav class="flex gap-4">
                <Link class="text-3xl" href="/canvas1" autofocus >Canvas 1</Link>
            </nav>

            <h1>Hi 👋</h1>
            <div>
                Can't wait to see what you build with qwik!
                <br />
                Happy coding.
            </div>
            <Inventory />
        </div>
    );
});

export const head: DocumentHead = {
    title: "Vim-World",
    meta: [
        {
            name: "description",
            content: "Use Vim to nagivate the world",
        },
    ],
};


