import { isBrowser } from "@builder.io/qwik";
import { API_PORT } from "~/server/constants";

/**
 * The page, the API endpoints and the websocket are served by the same
 * server, so the host the page was loaded from is the API host.
 *
 * Hardcoding `localhost` here makes the client talk to its own machine
 * when the page is opened from another device (e.g. over Tailscale).
 */
export const apiOrigin = (): string =>
    isBrowser
        ? `${window.location.protocol}//${window.location.host}`
        : `http://localhost:${API_PORT}`;

/** Same origin as {@link apiOrigin}, with the websocket scheme. */
export const wsOrigin = (): string => {
    if (!isBrowser) return `ws://localhost:${API_PORT}`;
    const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
};
