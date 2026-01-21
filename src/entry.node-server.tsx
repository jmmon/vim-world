/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Express HTTP server when building for production.
 *
 * Learn more about Node.js server integrations here:
 * - https://qwik.dev/docs/deployments/node/
 *
 */
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";
import { createServer } from "node:http";
import { initializeWss } from "./server/wss/wss";
import { serverLoop } from "./server/wss/main";

// Allow for dynamic port
const PORT = process.env.PORT ?? 3000;


// Create the Qwik City express middleware
const { router, notFound, staticFile } = createQwikCity({
    render,
    qwikCityPlan,
    static: {
        cacheControl: "public, max-age=31536000, immutable",
    },
});

const server = createServer();
const wss = initializeWss(); // initialize websocket server
serverLoop(); // start loop (to detect afk for now)

server.on("request", (req, res) => {
    staticFile(req, res, () => {
        router(req, res, () => {
            notFound(req, res, () => {});
        });
    });
});
server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});

server.listen(PORT, () => {
    console.log(`Node server listening on http://localhost:${PORT}`);
});
