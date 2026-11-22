import { describe, expect, test, vi } from "vitest";
import {
    drawAfk,
    drawZoneHint,
    getAfkRect,
    getDevStatsStyles,
    getFpsStyles,
    getZoneHintRect,
} from "~/services/draw/overlay";
import type { GameState } from "~/hooks/useState";
import type { MapConfig } from "~/server/map";
import type { Viewport } from "~/simulation/client/types";

// Overlay Box rects must have integer edges so fillRect/clearRect are exact
// complements and dismissed boxes leave zero residue (issue #4).

// The style helpers only attach canvas.getContext("2d") to the returned
// object; they never call methods on it during style computation.
const canvasStub = () =>
    ({
        getContext: () => ({}) as CanvasRenderingContext2D,
    }) as unknown as HTMLCanvasElement;

const viewport = (width: number): Viewport => ({
    width,
    height: 720,
    origin: { x: 0, y: 0 },
});

const config = (scale: number): MapConfig =>
    ({ tileSize: 32, scale, lastScale: scale }) as MapConfig;

const WIDTHS = [800, 1023, 1024, 1280];
const FPS_WIDTHS = [800, 1023, 1280];
const SCALES = [1, 1.25];

const isInt = (n: number) => Number.isInteger(n);

describe("getZoneHintRect", () => {
    test("integer edges and outward rounding at scale 1 (spec source values)", () => {
        for (const width of WIDTHS) {
            const r = getZoneHintRect(viewport(width), config(1));
            // spec source values at tileSize 32: w = 288, h = 51.2, top = 16
            const w = 32 * 9;
            const h = 32 * 1.6;
            const left = (width - w) / 2;
            const top = 32 * 0.5;
            expect(isInt(r.left)).toBe(true);
            expect(isInt(r.top)).toBe(true);
            expect(isInt(r.left + r.w)).toBe(true);
            expect(isInt(r.top + r.h)).toBe(true);
            // rounded rect contains the unrounded source rect ...
            expect(r.left).toBeLessThanOrEqual(left);
            expect(r.top).toBeLessThanOrEqual(top);
            expect(r.left + r.w).toBeGreaterThanOrEqual(left + w);
            expect(r.top + r.h).toBeGreaterThanOrEqual(top + h);
            // ... with each edge moved by < 1 px (no arbitrary padding)
            expect(r.left).toBeGreaterThan(left - 1);
            expect(r.top).toBeGreaterThan(top - 1);
            expect(r.left + r.w).toBeLessThan(left + w + 1);
            expect(r.top + r.h).toBeLessThan(top + h + 1);
        }
    });

    test("integer edges hold at fractional scale 1.25", () => {
        for (const width of WIDTHS) {
            const r = getZoneHintRect(viewport(width), config(1.25));
            expect(isInt(r.left)).toBe(true);
            expect(isInt(r.top)).toBe(true);
            expect(isInt(r.left + r.w)).toBe(true);
            expect(isInt(r.top + r.h)).toBe(true);
        }
    });
});

// Issue #12: the AFK box moved down to y = 2.5·tileSize so it never
// intersects the Zone Hint box (the overlap caused a silent-erase bug), and
// drawAfk centers its text in the box and restores the textAlign it sets.

describe("getAfkRect", () => {
    test("y is 2.5·tileSize with x, width, height unchanged (AC1)", () => {
        const r = getAfkRect(viewport(1280), config(1));
        expect(r[0]).toBe(32 * 6.5); // 208
        expect(r[1]).toBe(32 * 2.5); // 80
        expect(r[2]).toBe(1280 - 32 * 13); // 864
        expect(r[3]).toBe(32 * 5); // 160
    });

    test("disjoint from the Zone Hint rect across widths and scales (AC2)", () => {
        for (const tiles of [20, 40, 100]) {
            for (const scale of [1, 1.25]) {
                const vp = viewport(tiles * 32);
                const cfg = config(scale);
                const afk = getAfkRect(vp, cfg);
                const hint = getZoneHintRect(vp, cfg);
                // AFK top must sit at or below the hint's rounded bottom
                expect(afk[1]).toBeGreaterThanOrEqual(hint.top + hint.h);
            }
        }
    });
});

describe("getFpsStyles", () => {
    test("integer edges with right edge flush at viewport.width across the matrix", () => {
        for (const width of FPS_WIDTHS) {
            for (const scale of SCALES) {
                for (const fps of ["5.00", "60.00", "120.00"]) {
                    for (const ema of [undefined, "16.7"]) {
                        const s = getFpsStyles(
                            viewport(width),
                            config(scale),
                            canvasStub(),
                            fps,
                            ema,
                        );
                        expect(isInt(s.x)).toBe(true);
                        expect(isInt(s.y)).toBe(true);
                        expect(isInt(s.x + s.width)).toBe(true);
                        expect(isInt(s.y + s.height)).toBe(true);
                        // right-anchored box: rounded right edge stays flush
                        expect(s.x + s.width).toBe(width);
                    }
                }
            }
        }
    });

    test("box width grows with fps string length (drives the residue bug)", () => {
        const vp = viewport(1280);
        const cfg = config(1);
        const narrow = getFpsStyles(vp, cfg, canvasStub(), "5.00");
        const wide = getFpsStyles(vp, cfg, canvasStub(), "120.00");
        // a longer value must produce a strictly wider box; if width ignored
        // the string, the length-change strip could never be reproduced
        expect(wide.width).toBeGreaterThan(narrow.width);
    });
});

describe("getDevStatsStyles", () => {
    test("integer edges across the width / scale matrix", () => {
        for (const width of FPS_WIDTHS) {
            for (const scale of SCALES) {
                const s = getDevStatsStyles(
                    viewport(width),
                    config(scale),
                    canvasStub(),
                );
                expect(isInt(s.x)).toBe(true);
                expect(isInt(s.y)).toBe(true);
                expect(isInt(s.x + s.width)).toBe(true);
                expect(isInt(s.y + s.height)).toBe(true);
            }
        }
    });
});

// Issue #5: drawZoneHint mutates ctx.textAlign / ctx.textBaseline and must
// restore them, or the leaked "middle" baseline shifts the statusbar text ~5px
// and the leaked "center" alignment spills the help hint out of its clear rect.

/** fake 2D ctx recording the text state visible at each fillText call. */
function recordingCtx() {
    const seen: { text: string; textAlign: string; textBaseline: string }[] =
        [];
    const ctx = {
        textAlign: "left",
        textBaseline: "alphabetic",
        font: "",
        fillStyle: "",
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn((text: string) => {
            seen.push({
                text,
                textAlign: ctx.textAlign,
                textBaseline: ctx.textBaseline,
            });
        }),
    };
    return { ctx, seen };
}

/** minimal state stub for drawZoneHint (spec §Test plan shape). */
function hintState(zoneHintText: string, ctx: unknown): GameState {
    return {
        refs: { overlay: { value: { getContext: () => ctx } } },
        ctx: {
            world: { config: { tileSize: 32, scale: 1, lastScale: 1 } },
            client: {
                viewport: { width: 1280, height: 720, origin: { x: 0, y: 0 } },
                zoneHintText,
            },
        },
    } as unknown as GameState;
}

describe("drawZoneHint text-state restore", () => {
    test("draws the verb centered and restores textAlign/textBaseline on return (AC5)", () => {
        const { ctx, seen } = recordingCtx();

        drawZoneHint(hintState("Hop gaps with w", ctx));

        // the verb was drawn exactly once, with the centered state in effect
        expect(seen).toHaveLength(1);
        expect(seen[0].text).toBe("Hop gaps with w");
        expect(seen[0].textAlign).toBe("center");
        expect(seen[0].textBaseline).toBe("middle");
        // ... and the mutated state is restored to the entry values
        expect(ctx.textAlign).toBe("left");
        expect(ctx.textBaseline).toBe("alphabetic");
    });

    test("empty verb draws nothing and leaves text state untouched (AC6)", () => {
        const { ctx, seen } = recordingCtx();

        drawZoneHint(hintState("", ctx));

        expect(ctx.fillText).not.toHaveBeenCalled();
        expect(seen).toHaveLength(0);
        expect(ctx.textAlign).toBe("left");
        expect(ctx.textBaseline).toBe("alphabetic");
    });
});

/** minimal state stub for drawAfk: scale === lastScale keeps
 *  hasScaleChanged false so closeAfk clears exactly one rect. */
function afkState(ctx: unknown): GameState {
    return {
        refs: { overlay: { value: { getContext: () => ctx } } },
        ctx: {
            show: { afk: true },
            world: { config: { tileSize: 32, scale: 1, lastScale: 1 } },
            client: {
                viewport: { width: 1280, height: 720, origin: { x: 0, y: 0 } },
            },
        },
    } as unknown as GameState;
}

describe("drawAfk", () => {
    test("draws centered and restores textAlign on return (AC3)", () => {
        const { ctx, seen } = recordingCtx();

        drawAfk(afkState(ctx));

        // the message was drawn exactly once, with center alignment in
        // effect ...
        expect(seen).toHaveLength(1);
        expect(seen[0].text).toBe("You are AFK!");
        expect(seen[0].textAlign).toBe("center");
        // ... and the entry value is restored, so later Help / Help Hint
        // text is not silently center-aligned
        expect(ctx.textAlign).toBe("left");
    });

    test("fillText centers the message in the box at its new position (AC4)", () => {
        const { ctx } = recordingCtx();

        drawAfk(afkState(ctx));

        // box at tileSize 32: x = 208, y = 80, w = 1280 − 416 = 864, h = 160
        expect(ctx.fillText).toHaveBeenCalledWith(
            "You are AFK!",
            208 + 864 / 2,
            80 + 160 / 2,
        );
    });

    test("clear-first clears the rect at the new position (AC5)", () => {
        const { ctx } = recordingCtx();

        drawAfk(afkState(ctx));

        // scale === lastScale, so exactly one clear: the new AFK rect
        expect(ctx.clearRect).toHaveBeenCalledTimes(1);
        expect(ctx.clearRect).toHaveBeenCalledWith(208, 80, 864, 160);
    });
});
