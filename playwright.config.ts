import { defineConfig } from "@playwright/test";

// Thin browser tier: rendering + client prediction + ws transport.
// Logic is owned by the headless playtest suite (pnpm playtest).
export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    // one shared in-memory server world; the intro arc is sequential
    workers: 1,
    fullyParallel: false,
    use: {
        baseURL: "http://localhost:5173",
        viewport: { width: 1280, height: 720 },
    },
    webServer: {
        command: "pnpm dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
