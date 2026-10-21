import type { Plugin, ViteDevServer } from "vite";
import type { WebSocketServer } from "ws";

/**
 * Runs the websocket server and tick loop inside the vite dev server, so
 * `pnpm dev` gives the same game as `pnpm serve` without a production build.
 *
 * Everything is loaded through `server.ssrLoadModule`, which is the same
 * loader qwik city uses for route endpoints. That is what makes the world
 * shared: `/api/player` and `/api/map` read the very same serverState
 * singletons the socket handlers write to. A static import here would fork
 * the module graph and give the dev server two different worlds.
 */

const WATCHED = [
    "src/server",
    "src/simulation",
    "src/types",
];
const WATCHED_FILES = ["src/services/chunk.ts"];

const toMs = (value: string | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const isWatched = (file: string) => {
    const normalized = file.replace(/\\/g, "/");
    return (
        WATCHED.some((dir) => normalized.includes(`/${dir}/`)) ||
        WATCHED_FILES.some((file) => normalized.endsWith(`/${file}`))
    );
};

type ClientLike = {
    ws: { send: (data: string) => void; terminate: () => void };
};

type GameStack = {
    wss: WebSocketServer;
    stopLoop: () => void;
    /**
     * The clients map of the module instance this stack was built from.
     * It has to be captured here: after a server file changes, loading the
     * module again yields a fresh empty map, while the live sockets are
     * still held by the instance we are tearing down.
     */
    clients: Map<string, ClientLike>;
};

export function devGameServer(): Plugin {
    let stack: GameStack | undefined;
    let reloading = false;
    let pending = false;

    const loadStack = async (server: ViteDevServer): Promise<GameStack> => {
        const [{ initializeWss }, loopModule, { clients }] = await Promise.all([
            server.ssrLoadModule("/src/server/wss/wss.ts") as Promise<{
                initializeWss: (lag: { lagMs: number; jitterMs: number }) => WebSocketServer;
            }>,
            server.ssrLoadModule("/src/server/serverLoop.ts") as Promise<{
                default: () => () => void;
            }>,
            server.ssrLoadModule("/src/server/serverState.ts") as Promise<{
                clients: Map<string, ClientLike>;
            }>,
        ]);

        const wss = initializeWss({
            lagMs: toMs(process.env.VIMWORLD_LAG_MS),
            jitterMs: toMs(process.env.VIMWORLD_LAG_JITTER_MS),
        });
        const stopLoop = loopModule.default();
        return { wss, stopLoop, clients };
    };

    /** stop the old loop and drop its sockets before fresh modules are loaded */
    const teardown = () => {
        const old = stack;
        stack = undefined;
        old?.stopLoop();

        for (const client of Array.from(old?.clients.values() ?? [])) {
            try {
                // the client handles CLOSE by navigating home and relogging in
                client.ws.send(JSON.stringify({ type: "CLOSE" }));
                client.ws.terminate();
            } catch {
                // already gone
            }
        }
    };

    return {
        name: "vim-world-dev-game-server",
        // only a real dev server: not a build, and not vitest, which serves
        // in dev mode too and would otherwise keep a tick loop running
        apply: (_config, env) => env.command === "serve" && env.mode !== "test",

        configureServer(server) {
            server.httpServer?.on("upgrade", (req, socket, head) => {
                // only /ws is ours; vite keeps its own hmr upgrade untouched
                if (req.url?.split("?")[0] !== "/ws") return;
                if (!stack) {
                    socket.destroy();
                    return;
                }
                stack.wss.handleUpgrade(req, socket, head, (ws) => {
                    stack?.wss.emit("connection", ws, req);
                });
            });

            void loadStack(server)
                .then((loaded) => {
                    stack = loaded;
                    const { lagMs, jitterMs } = {
                        lagMs: toMs(process.env.VIMWORLD_LAG_MS),
                        jitterMs: toMs(process.env.VIMWORLD_LAG_JITTER_MS),
                    };
                    server.config.logger.info(
                        `vim-world dev game server ready on ws://localhost:${server.config.server.port ?? 5173}/ws` +
                            (lagMs || jitterMs
                                ? ` (lag ${lagMs}ms +/- ${jitterMs}ms)`
                                : ""),
                    );
                })
                .catch((err) => {
                    server.config.logger.error(
                        `vim-world dev game server failed to start: ${
                            (err as Error)?.stack ?? err
                        }`,
                    );
                });

            let timer: ReturnType<typeof setTimeout> | undefined;

            /** server files reloaded their modules out from under us: rebuild the stack */
            const reset = async () => {
                if (reloading) {
                    pending = true;
                    return;
                }
                reloading = true;
                try {
                    teardown();
                    stack = await loadStack(server);
                    server.config.logger.info(
                        "vim-world dev game server reloaded (world reset)",
                    );
                } catch (err) {
                    server.config.logger.error(
                        `vim-world dev reload failed: ${(err as Error)?.stack ?? err}`,
                    );
                } finally {
                    reloading = false;
                    if (pending) {
                        pending = false;
                        void reset();
                    }
                }
            };

            server.watcher.on("change", (file) => {
                if (!isWatched(file)) return;
                clearTimeout(timer);
                timer = setTimeout(() => void reset(), 150);
            });
        },
    };
}