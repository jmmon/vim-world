import { test, expect, Page } from "@playwright/test";

// Thin browser gate over the intro arc (mirrors src/server/playtest/scenarios).
// Logic is already locked by the playtest suite; this tier checks what only a
// browser sees: rendering, client prediction/reconciliation, ws transport, and
// the zone-hint wiring. Asserts state via the dev-only window.__vimworld hook.

// fixed name so the drawn name label is pixel-stable; requires a fresh dev
// server (in-memory checkpoints would otherwise restore an old position —
// the room3 chest guard fails loudly if the world is stale)
const username = "e2e-intro-player";
let page: Page;

test.describe.configure({ mode: "serial" });

/** Press keys one at a time (counts first, e.g. "1","7","l" = 17l).
 *  Small gap: the FSM buffers counts/operators with a timeout and rapid-fire
 *  presses can interleave with in-flight acks. */
async function press(...keys: string[]) {
    for (const k of keys) {
        await page.keyboard.press(k);
        await page.waitForTimeout(100);
    }
}

function snap() {
    return page.evaluate(() => {
        const c = (window as any).__vimworld;
        if (!c) return null;
        const door = c.world.entities.get("DOOR-1");
        return {
            pos: c.client.player?.pos,
            dir: c.client.player?.dir,
            itemIds: c.client.player?.itemIds ?? [],
            zoneHintText: c.client.zoneHintText as string,
            door: door
                ? { open: door.state?.open, locked: door.state?.locked }
                : null,
        };
    });
}

async function pollPos(x: number, y: number) {
    await expect
        .poll(async () => (await snap())?.pos, { timeout: 15_000 })
        .toEqual({ x, y });
}

/** Clean shot: hide the dev overlay (fps, chunk debug, dev stats), force an
 *  overlay redraw, then wait a few frames for the erase to land. */
async function shot(name: string) {
    await page.evaluate(() => {
        const w = (window as any).__vimworld;
        w.show.devStats = false;
        w.client.isDirty.overlay = true;
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`${name}.png`);
}

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/canvas1");
    await page.locator("#username").fill(username);
    await page.getByRole("button", { name: "Submit" }).click();
    // gate on isReady (login done) AND lastAckCheckpoint (INIT.CONFIRM +
    // first checkpoint ack round-trip). keys sent earlier get dropped on
    // the post-confirm reconcile.
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

test("room 1: hjkl moves the player", async () => {
    await press("j", "j", "j", "l", "l", "k", "k", "h", "h");
    await pollPos(2, 9);
    expect((await snap())?.dir).toBe("W");
    // walk back to spawn row so the cumulative room2+ sequences match the
    // playtest scenarios (each starts from spawn (2,8))
    await press("k");
    await pollPos(2, 8);
    await shot("room1-hjkl");
});

test("room 2: w hops the water gaps", async () => {
    await press("1", "7", "l", "w", "2", "l", "w", "2", "l", "w", "2", "l");
    await pollPos(31, 8);
    await shot("room2-hop");
});

test('room 3: yi" yanks the key from the chest', async () => {
    // room2 left us at (31,8); the scenario's 11l from (29,8) lands at (40,8)
    // in front of the chest, and k is blocked by it (faces it, dir N)
    await press("9", "l", "k");
    await pollPos(40, 8);
    // the hint re-shows after the stuck/idle window (~3s of no input)
    await expect
        .poll(async () => (await snap())?.zoneHintText, { timeout: 10_000 })
        .toMatch(/take the key/i);
    await shot("room3-yank"); // hint panel visible in the golden
    // the chest is shared world state: a previous run against the same dev
    // server already emptied it. Fail loudly instead of timing out.
    const chestHas = await page.evaluate(
        () =>
            (window as any).__vimworld.world.entities.get("CHEST-KEY")
                ?.container?.itemIds?.length ?? 0,
    );
    if (chestHas === 0)
        throw new Error(
            'stale world: chest already emptied by an earlier run — restart the dev server for a fresh world',
        );
    // yanking the key solves the zone and auto-dismisses the hint
    await press("y", "i", '"');
    await expect
        .poll(async () => (await snap())?.itemIds.length, { timeout: 10_000 })
        .toBe(1);
});

test('room 4: pi" unlocks the door', async () => {
    await press("l", "1", "0", "l", "w", "9", "l", "k", "p", "i", '"');
    await pollPos(62, 8);
    await expect
        .poll(async () => (await snap())?.door, { timeout: 10_000 })
        .toEqual({ open: true, locked: false });
    expect((await snap())?.itemIds.length).toBe(0);
    await shot("room4-paste");
});

test("room 5: walking east reaches the exit", async () => {
    await press("l", "3", "l");
    await pollPos(66, 8);
    await shot("room5-exit");
});
