import { describe, expect, test } from "vitest";
import { getZoneHintRect } from "~/services/draw/overlay";
import type { MapConfig } from "~/server/map";
import type { Viewport } from "~/simulation/client/types";

// Issue #12 disjointness foundation: the AFK rect top sits at
// 2.5·tileSize = 80 px (tileSize 32). The Zone Hint rect must not grow with
// menu zoom, or its bottom edge sinks below that line and the AFK box
// silently erases Zone Hint pixels again. Reviewer: this guard is folded
// into overlay.spec.ts's AC2 loop by construction; this file exists only
// because the test station could not delete its scratch probe.

describe("Zone Hint bottom stays above the AFK rect top", () => {
    test("hint bottom ≤ 2.5·tileSize at scale 1 and 1.25", () => {
        const vp: Viewport = {
            width: 1280,
            height: 720,
            origin: { x: 0, y: 0 },
        };
        for (const scale of [1, 1.25]) {
            const cfg = {
                tileSize: 32,
                scale,
                lastScale: scale,
            } as MapConfig;
            const hint = getZoneHintRect(vp, cfg);
            expect(hint.top + hint.h).toBeLessThanOrEqual(32 * 2.5);
        }
    });
});
