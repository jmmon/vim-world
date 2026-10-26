import { describe, expect, test } from "vitest";
import { formatDuration } from "~/utils/duration";

describe("formatDuration", () => {
    test("renders sub-second values as integer milliseconds", () => {
        expect(formatDuration(350)).toBe("350ms");
        expect(formatDuration(0)).toBe("0ms");
        expect(formatDuration(999)).toBe("999ms");
    });

    test("renders a second or more as seconds with one decimal place", () => {
        expect(formatDuration(1000)).toBe("1.0s");
        expect(formatDuration(1200)).toBe("1.2s");
        expect(formatDuration(2000)).toBe("2.0s");
        expect(formatDuration(1499)).toBe("1.5s");
    });

    test("falls back to 0ms for negative and non-finite input", () => {
        expect(formatDuration(-1)).toBe("0ms");
        expect(formatDuration(-0.5)).toBe("0ms");
        expect(formatDuration(NaN)).toBe("0ms");
        expect(formatDuration(Infinity)).toBe("0ms");
        expect(formatDuration(-Infinity)).toBe("0ms");
    });

    test("exports a function with a stable identity across imports", async () => {
        expect(typeof formatDuration).toBe("function");

        const first = await import("~/utils/duration");
        const second = await import("~/utils/duration");

        expect(typeof first.formatDuration).toBe("function");
        expect(first.formatDuration).toBe(formatDuration);
        expect(second.formatDuration).toBe(first.formatDuration);
    });
});
