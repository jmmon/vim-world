import { describe, expect, test } from "vitest";
import viewport from "~/simulation/client/viewport";
import type { GameState } from "~/hooks/useState";

// Issue #11: updateCanvas must resize the four canvas backing stores to the
// live viewport (guarded so unchanged dims never clear the bitmap) and raise
// the one-shot needsOverlayRepaint flag only when an assignment happened.
// Stub style follows src/services/draw/overlay.spec.ts: minimal objects cast
// through `as unknown as …`; updateCanvasDimensions only touches
// refs.*.value.style, ctx.client.viewport and ctx.client.needsOverlayRepaint.

interface CanvasStub {
    style: Record<string, string>;
    width: number;
    height: number;
    /** assignment counters: assigning canvas.width/height clears the bitmap,
     *  so "zero assignments" is the observable contract, not just final value */
    widthSets: number;
    heightSets: number;
}

const canvasStub = (width: number, height: number): CanvasStub => {
    const stub = { style: {}, widthSets: 0, heightSets: 0 } as CanvasStub;
    let w = width;
    let h = height;
    Object.defineProperty(stub, "width", {
        get: () => w,
        set: (v: number) => {
            stub.widthSets += 1;
            w = v;
        },
    });
    Object.defineProperty(stub, "height", {
        get: () => h,
        set: (v: number) => {
            stub.heightSets += 1;
            h = v;
        },
    });
    return stub;
};

const CANVAS_KEYS = ["map", "objects", "players", "overlay"] as const;

const makeState = (
    vp: { width: number; height: number },
    canvas: { width: number; height: number },
) => {
    const raw = {
        refs: {
            // container is a div: CSS-only sizing, no backing store
            container: { value: { style: {} as Record<string, string> } },
            map: { value: canvasStub(canvas.width, canvas.height) },
            objects: { value: canvasStub(canvas.width, canvas.height) },
            players: { value: canvasStub(canvas.width, canvas.height) },
            overlay: { value: canvasStub(canvas.width, canvas.height) },
        },
        ctx: {
            client: {
                viewport: {
                    origin: { x: 0, y: 0 },
                    width: vp.width,
                    height: vp.height,
                },
                needsOverlayRepaint: false,
            },
        },
    };
    return { raw, state: raw as unknown as GameState };
};

const VP = { width: 1280, height: 720 };

describe("viewport.updateCanvas backing-store resize", () => {
    test("all dims differ: every canvas is resized and the flag is raised (AC1)", () => {
        const { raw, state } = makeState(VP, { width: 640, height: 360 });
        viewport.updateCanvas(state);
        for (const key of CANVAS_KEYS) {
            const c = raw.refs[key].value;
            expect(c.width).toBe(VP.width);
            expect(c.height).toBe(VP.height);
            expect(c.widthSets).toBe(1);
            expect(c.heightSets).toBe(1);
        }
        expect(raw.ctx.client.needsOverlayRepaint).toBe(true);
    });

    test("dims already equal: zero assignments, flag stays false (AC2)", () => {
        const { raw, state } = makeState(VP, { width: VP.width, height: VP.height });
        viewport.updateCanvas(state);
        for (const key of CANVAS_KEYS) {
            const c = raw.refs[key].value;
            // assigning even the same value clears the canvas bitmap, so the
            // guard must produce literally zero width/height assignments
            expect(c.widthSets).toBe(0);
            expect(c.heightSets).toBe(0);
        }
        expect(raw.ctx.client.needsOverlayRepaint).toBe(false);
    });

    test("only width differs: width assigned, height untouched, flag raised (AC3)", () => {
        const { raw, state } = makeState(VP, { width: 640, height: VP.height });
        viewport.updateCanvas(state);
        for (const key of CANVAS_KEYS) {
            const c = raw.refs[key].value;
            expect(c.width).toBe(VP.width);
            expect(c.widthSets).toBe(1);
            expect(c.height).toBe(VP.height);
            expect(c.heightSets).toBe(0);
        }
        expect(raw.ctx.client.needsOverlayRepaint).toBe(true);
    });

    test("CSS style sizing on container and all four canvases is preserved (AC4)", () => {
        const { raw, state } = makeState(
            { width: 1000, height: 600 },
            { width: 640, height: 360 },
        );
        viewport.updateCanvas(state);
        const css = { width: "1000px", height: "600px" };
        expect(raw.refs.container.value.style).toEqual(css);
        for (const key of CANVAS_KEYS) {
            expect(raw.refs[key].value.style).toEqual(css);
        }
    });
});
