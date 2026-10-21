import { describe, expect, test } from "vitest";
import { expandAction } from "./helpers";
import { MOVEMENT_CONFIG, processPlayerTick } from "./loop";
import { ExpandedVimAction, VimAction } from "~/fsm/types";
import { ClientActionMessage } from "~/types/wss/client";

const move = (count?: number): VimAction =>
    count === undefined
        ? { type: "MOVE", key: "j" }
        : { type: "MOVE", key: "j", count };

const actionMsg = (seq: number, count?: number): ClientActionMessage => ({
    type: "ACTION",
    seq,
    clientTime: 1000 + seq,
    action: move(count),
});

const countsOf = (steps: ExpandedVimAction[]) => steps.map((s) => s.count);

describe("expandAction", () => {
    test("defaults to a single step", () => {
        const steps = expandAction(actionMsg(7), 4);
        expect(steps).toHaveLength(1);
        expect(steps[0].count).toBe(1);
        expect(steps[0].remaining).toBe(0);
        expect(steps[0].key).toBe("j");
        expect(steps[0].type).toBe("MOVE");
    });

    test("keeps a single step when the count fits in one tick", () => {
        expect(countsOf(expandAction(actionMsg(1, 1), 0))).toEqual([1]);
        expect(countsOf(expandAction(actionMsg(1, 2), 0))).toEqual([2]);
        expect(countsOf(expandAction(actionMsg(1, 3), 0))).toEqual([3]);
    });

    test("splits a count across ticks and keeps every step", () => {
        expect(countsOf(expandAction(actionMsg(1, 4), 0))).toEqual([3, 1]);
        expect(countsOf(expandAction(actionMsg(1, 10), 0))).toEqual([3, 3, 3, 1]);
        expect(countsOf(expandAction(actionMsg(1, 12), 0))).toEqual([3, 3, 3, 3]);
    });

    test("step counts always sum back to the requested count", () => {
        for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20]) {
            const total = countsOf(expandAction(actionMsg(1, count), 0)).reduce(
                (a, b) => (a ?? 0) + (b ?? 0),
                0,
            );
            expect(total, `count ${count}`).toBe(count);
        }
    });

    test("clamps counts above the macro limit", () => {
        const steps = expandAction(actionMsg(1, 100000), 0);
        const total = countsOf(steps).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
        expect(total).toBe(MOVEMENT_CONFIG.MAX_MACRO_COUNT);
    });

    test("no step exceeds the per tick limit", () => {
        const steps = expandAction(actionMsg(1, 20), 0);
        for (const step of steps) {
            expect(step.count).toBeGreaterThan(0);
            expect(step.count).toBeLessThanOrEqual(MOVEMENT_CONFIG.maxCountPerTick);
        }
    });

    test("remaining counts down to zero", () => {
        const steps = expandAction(actionMsg(1, 10), 0);
        expect(steps.map((s) => s.remaining)).toEqual([3, 2, 1, 0]);
    });

    test("only the final step carries the new sequence", () => {
        const steps = expandAction(actionMsg(9, 10), 4);
        expect(steps.map((s) => s.seq)).toEqual([4, 4, 4, 9]);
    });
});

describe("processPlayerTick", () => {
    const ctx = {} as never;

    const playerWith = (steps: ExpandedVimAction[], lastProcessedSeq = -1) => ({
        actionQueue: steps,
        lastProcessedSeq,
    });

    const expand = (seq: number, count?: number) =>
        expandAction(actionMsg(seq, count), seq - 1);

    test("consumes steps until the per tick budget runs out", () => {
        const player = playerWith(expand(1, 10));
        const seen: string[] = [];

        processPlayerTick(ctx, player, 0, (_ctx, action) => {
            seen.push(`${action.seq}:${action.count}`);
            return undefined;
        });

        // 10j expands to 3+3+3+1 and a tick may spend 3, so only the first
        // partial runs this tick
        expect(seen).toEqual(["0:3"]);
        expect(player.actionQueue).toHaveLength(3);
        expect(player.lastProcessedSeq).toBe(-1);
    });

    test("advances the sequence once the final step runs", () => {
        const player = playerWith(expand(1, 4));

        for (let tick = 0; tick < 2; tick++) {
            processPlayerTick(ctx, player, tick, () => undefined);
        }

        expect(player.actionQueue).toHaveLength(0);
        expect(player.lastProcessedSeq).toBe(1);
    });

    test("partials report the previous sequence until the last step", () => {
        const player = playerWith(expand(5, 10), 4);

        processPlayerTick(ctx, player, 0, () => undefined);

        expect(player.lastProcessedSeq).toBe(4);
        expect(player.actionQueue[0].seq).toBe(4);
    });

    test("a collision drops the remaining steps of the action", () => {
        const player = playerWith(expand(2, 10), 1);

        processPlayerTick(ctx, player, 0, () => "COLLISION" as never);

        expect(player.actionQueue).toHaveLength(0);
        expect(player.lastProcessedSeq).toBe(2);
    });

    test("stops draining the queue on out of bounds", () => {
        const player = playerWith([...expand(3, 10), ...expand(4, 1)], 2);
        let calls = 0;

        processPlayerTick(ctx, player, 0, () => {
            calls++;
            return "OUT_OF_BOUNDS" as never;
        });

        // the next action is left untouched in the queue
        expect(calls).toBe(1);
        expect(player.actionQueue.map((s) => s.seq)).toEqual([4]);
    });

    test("an empty queue is a no-op", () => {
        const player = playerWith([]);
        let calls = 0;

        processPlayerTick(ctx, player, 0, () => {
            calls++;
            return undefined;
        });

        expect(calls).toBe(0);
    });
});