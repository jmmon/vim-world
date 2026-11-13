import { describe, expect, test } from "vitest";
import { GHOST_ALPHA } from "~/components/canvas1/constants";

// other players render as ghosts: the same colour, just translucent (no tint).
describe("ghosts", () => {
    test("ghost alpha is ~0.4 — translucent but still readable", () => {
        expect(GHOST_ALPHA).toBeGreaterThan(0.3);
        expect(GHOST_ALPHA).toBeLessThan(0.5);
    });

    test("ghost alpha is a valid opacity in (0,1)", () => {
        expect(GHOST_ALPHA).toBeGreaterThan(0);
        expect(GHOST_ALPHA).toBeLessThan(1);
    });
});
