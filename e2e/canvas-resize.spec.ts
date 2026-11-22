import { test, expect, Page } from "@playwright/test";

// Issue #11 gate: `:set columns/lines` must resize the canvas backing stores
// so the bitmap is never stretched, and the help Overlay Box must reappear at
// the post-resize rect after the resize clears the backing store
// (specs/issue-11.md AC5-9). Harness follows e2e/intro.spec.ts: fresh dev
// server (in-memory world), login, poll isReady + lastAckCheckpoint.

const username = "e2e-resize-player";
let page: Page;

test.describe.configure({ mode: "serial" });

/** Press keys one at a time; the intro spec's 100 ms inter-key gap keeps the
 *  command-line FSM from interleaving presses with in-flight acks. */
async function press(...keys: string[]) {
    for (const k of keys) {
        await page.keyboard.press(k);
        await page.waitForTimeout(100);
    }
}

/** Run an ex-command: ":", the command text one key at a time, Enter. */
async function runCommand(cmd: string) {
    await press(":", ...cmd.split(""));
    await page.keyboard.press("Enter");
}

async function waitForSetting(key: "columns" | "lines", value: number) {
    await expect
        .poll(
            () =>
                page.evaluate(
                    (k) => (window as any).__vimworld?.client?.settings?.[k],
                    key,
                ),
            { timeout: 10_000 },
        )
        .toBe(value);
}

const overlayCanvas = () => page.locator('canvas[data-name="overlay"]');

/** Overlay canvas backing-store attrs (reflected attributes) vs live viewport
 *  dims and CSS layout size. */
function overlayDims() {
    return page.evaluate(() => {
        const canvas = document.querySelector(
            'canvas[data-name="overlay"]',
        ) as HTMLCanvasElement;
        const vp = (window as any).__vimworld.client.viewport;
        const rect = canvas.getBoundingClientRect();
        return {
            width: canvas.width,
            height: canvas.height,
            vpWidth: vp.width,
            vpHeight: vp.height,
            cssWidth: rect.width,
            cssHeight: rect.height,
        };
    });
}

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/canvas1");
    await page.locator("#username").fill(username);
    await page.getByRole("button", { name: "Submit" }).click();
    // gate on isReady (login done) AND lastAckCheckpoint (INIT.CONFIRM +
    // first checkpoint ack round-trip), same as the intro spec
    await expect
        .poll(
            async () =>
                await page.evaluate(
                    () =>
                        !!(window as any).__vimworld?.client?.isReady &&
                        !!(window as any).__vimworld?.client?.lastAckCheckpoint,
                ),
            { timeout: 20_000 },
        )
        .toBe(true);
});

test.afterAll(async () => {
    await page.close();
});

test(":set columns=40 resizes the overlay backing store to viewport.width (AC5)", async () => {
    await runCommand("set columns=40");
    await waitForSetting("columns", 40);
    // :set path: viewport.width = columns × tileSize, both integers → exact
    const d = await overlayDims();
    expect(Number.isInteger(d.vpWidth)).toBe(true);
    const attr = await overlayCanvas().getAttribute("width");
    expect(Number(attr)).toBe(d.vpWidth);
    expect(d.width).toBe(d.vpWidth);
});

test(":set lines=20 resizes the overlay backing store to viewport.height (AC6)", async () => {
    await runCommand("set lines=20");
    await waitForSetting("lines", 20);
    const d = await overlayDims();
    expect(Number.isInteger(d.vpHeight)).toBe(true);
    const attr = await overlayCanvas().getAttribute("height");
    expect(Number(attr)).toBe(d.vpHeight);
    expect(d.height).toBe(d.vpHeight);
});

test("overlay canvas is not stretched: backing store equals CSS size (AC7)", async () => {
    const d = await overlayDims();
    // a stretched canvas has backing store != CSS layout size; the resize
    // must keep them 1:1 (sub-pixel tolerance for getBoundingClientRect)
    expect(Math.abs(d.width - d.cssWidth)).toBeLessThan(1);
    expect(Math.abs(d.height - d.cssHeight)).toBeLessThan(1);
});

test("help Overlay Box redraws at the post-resize rect (AC8+AC9)", async () => {
    // start from the default 32 columns (earlier tests left it at 40) so the
    // widening actually moves the help rect; otherwise AC8/9 pass vacuously
    await runCommand("set columns=32");
    await waitForSetting("columns", 32);
    await runCommand("help");
    await expect
        .poll(
            () => page.evaluate(() => (window as any).__vimworld?.show?.help),
            { timeout: 10_000 },
        )
        .toBe(true);
    await runCommand("set columns=40");
    await waitForSetting("columns", 40);
    // a few frames for the resize + same-frame overlay repaint
    await page.waitForTimeout(300);
    const alpha = await page.evaluate(() => {
        const canvas = document.querySelector(
            'canvas[data-name="overlay"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext("2d")!;
        const ts = (window as any).__vimworld.world.config.tileSize;
        const vp = (window as any).__vimworld.client.viewport;
        // generateHelpDimensions rect from the POST-resize viewport
        const left = ts * 0.5;
        const top = vp.height - 8.5 * ts;
        const w = vp.width - ts;
        const h = 8 * ts;
        const opaquePixels = (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(x, y, w, h).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            return n;
        };
        // top 75 % band only: the statusbar Overlay Box overlaps the help
        // rect's bottom and repaints every frame, so whole-rect or
        // whole-canvas alpha would pass even with a broken help redraw
        const band = opaquePixels(left, top, w, h * 0.75);
        // rightmost 1-tile strip only the post-resize rect covers: a redraw
        // at stale cached (pre-resize) dimensions leaves it transparent
        const newRight = vp.width - 0.5 * ts;
        const strip = opaquePixels(newRight - ts, top, ts, h * 0.75);
        return { band, strip };
    });
    expect(alpha.band).toBeGreaterThan(0);
    expect(alpha.strip).toBeGreaterThan(0);
});
