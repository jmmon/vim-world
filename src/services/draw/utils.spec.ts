import { describe, expect, test } from "vitest";
import { pixelRect } from "~/services/draw/utils";

// pixelRect rounds a rect outward to device pixels so fillRect/clearRect
// always cover pixel-identical, pixel-aligned regions (issue #4).

describe("pixelRect", () => {
    test("floors left/top and ceils right/bottom on fractional input", () => {
        const r = pixelRect(10.2, 20.7, 30.9, 40.1);
        expect(r.left).toBe(10);
        expect(r.top).toBe(20);
        expect(r.right).toBe(31);
        expect(r.bottom).toBe(41);
    });

    test("integer inputs pass through unchanged (no ±1 px growth)", () => {
        const r = pixelRect(4, 8, 12, 16);
        expect(r.left).toBe(4);
        expect(r.top).toBe(8);
        expect(r.right).toBe(12);
        expect(r.bottom).toBe(16);

        const neg = pixelRect(-4, -8, 12, 16);
        expect(neg.left).toBe(-4);
        expect(neg.top).toBe(-8);
        expect(neg.right).toBe(12);
        expect(neg.bottom).toBe(16);
    });

    test("negative coordinates floor toward −∞ and ceil toward +∞", () => {
        const r = pixelRect(-10.8, -3.2, -1.4, 6.6);
        expect(r.left).toBe(-11);
        expect(r.top).toBe(-4);
        expect(r.right).toBe(-1);
        expect(r.bottom).toBe(7);
    });

    test("result contains the input rect on every edge, grown by < 1 px", () => {
        const cases: Array<[number, number, number, number]> = [
            [1.2, 3.7, 8.9, 12.4],
            [-5.5, 0.5, 2.25, 9.75],
            [0, 0, 0.5, 0.5],
            [367.5, 16, 655.5, 67.2],
        ];
        for (const [left, top, right, bottom] of cases) {
            const r = pixelRect(left, top, right, bottom);
            expect(Number.isInteger(r.left)).toBe(true);
            expect(Number.isInteger(r.top)).toBe(true);
            expect(Number.isInteger(r.right)).toBe(true);
            expect(Number.isInteger(r.bottom)).toBe(true);
            // outward rounding: the rounded rect contains the input rect ...
            expect(r.left).toBeLessThanOrEqual(left);
            expect(r.top).toBeLessThanOrEqual(top);
            expect(r.right).toBeGreaterThanOrEqual(right);
            expect(r.bottom).toBeGreaterThanOrEqual(bottom);
            // ... and never grows by a full pixel
            expect(r.left).toBeGreaterThan(left - 1);
            expect(r.top).toBeGreaterThan(top - 1);
            expect(r.right).toBeLessThan(right + 1);
            expect(r.bottom).toBeLessThan(bottom + 1);
        }
    });
});
