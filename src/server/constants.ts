/**
 * In dev the API endpoints and the websocket are served by the vite dev
 * server itself (plugins/dev-server.ts), so the API port is the port vite
 * was started with: `pnpm dev --port N` must work without VITE_API_PORT,
 * otherwise SSR self-fetches (worldResource) hit the default 5173 and fail.
 *
 * shortcut: reads the CLI `--port` from process.argv (the SSR modules run in
 * the vite process). Without --strictPort vite may fall back to a different
 * port when the requested one is busy; upgrade by having the dev plugin
 * publish the resolved port if that ever bites.
 */
const viteCliPort = (): number | undefined => {
    if (typeof process === "undefined") return undefined;
    for (let i = 0; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const raw =
            arg === "--port"
                ? process.argv[i + 1]
                : arg.startsWith("--port=")
                  ? arg.slice("--port=".length)
                  : undefined;
        const port = Number(raw);
        if (raw !== undefined && Number.isInteger(port) && port > 0) {
            return port;
        }
    }
    return undefined;
};

export const API_PORT = import.meta.env.PROD
    ? (import.meta.env.VITE_API_PORT ?? 3000)
    : import.meta.env.DEV
        ? viteCliPort() || Number(import.meta.env.VITE_API_PORT) || 5173
        : 4173;
