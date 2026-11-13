import { describe, expect, test } from "vitest";
import { ZONE_GUIDES } from "~/services/draw/guides";
import {
    MAP_CONFIG,
    getHandAuthoredTileAt,
    isHandAuthoredZone,
    zone,
} from "~/server/map";

// static guide figures must sit on walkable grass tiles just before each
// landmark, inside the intro map bounds — otherwise they'd clip through a wall
// or float off the edge of the world.

describe("ZONE_GUIDES", () => {
    test("every guide is inside the intro map bounds", () => {
        for (const g of ZONE_GUIDES) {
            expect(g.x).toBeGreaterThanOrEqual(0);
            expect(g.x).toBeLessThan(MAP_CONFIG.worldWidth);
            expect(g.y).toBeGreaterThanOrEqual(0);
            expect(g.y).toBeLessThan(MAP_CONFIG.worldHeight);
        }
    });

    test("every guide stands on a walkable (non-colliding) grass tile", () => {
        expect(isHandAuthoredZone(zone)).toBe(true);
        if (!isHandAuthoredZone(zone)) {
            throw new Error("intro zone is not hand-authored");
        }
        for (const g of ZONE_GUIDES) {
            const tile = getHandAuthoredTileAt(zone, g.x, g.y);
            expect(tile.type).toBe("GRASS");
            expect(tile.collision).toBeUndefined();
        }
    });

    test("there is exactly one guide per landmark (gap, chest, keyhole, door)", () => {
        expect(ZONE_GUIDES).toHaveLength(4);
    });
});
