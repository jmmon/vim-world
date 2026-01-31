import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import Inventory from "~/components/inventory/inventory";

export default component$(() => {
    return (
        <div class="p-16">
            <Link class="text-3xl" href="/canvas1">Canvas 1</Link>
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
    title: "Welcome to Qwik",
    meta: [
        {
            name: "description",
            content: "Qwik site description",
        },
    ],
};
