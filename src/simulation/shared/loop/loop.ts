import { isBrowser } from "@builder.io/qwik";
import { ActionResult, ClientData, LocalWorldWrapper } from "~/components/canvas1/types";
import { buildGetEma } from "~/components/canvas1/utils";
import { ExpandedVimAction } from "~/fsm/types";
import { ServerWorldWrapper } from "~/server/types";
import { ReasonRejected } from "~/simulation/server/types";
import { ServerPlayer } from "~/types/worldTypes";

export type ApplyActionStepFn<
    T extends LocalWorldWrapper | ServerWorldWrapper,
> = (
    ctx: T,
    action: ExpandedVimAction,
    tick: number,
) => ActionResult['reason'] | ReasonRejected;

const TICKS_PER_SECOND = 20;
export const MOVEMENT_CONFIG = {
    ticksPerSecond: TICKS_PER_SECOND,
    tickMs: 1000 / TICKS_PER_SECOND,
    maxCountPerTick: 3, // 10j => 4 ticks: 3j x 3 + 1j x 1
    MAX_MACRO_COUNT: 20, // should be adjusted by level
} as const;

// NOTE:
// OK: so:
// 1. every tick will send back an ACK message, even if the message is only partially completed
// 2. seq in the message will be for the last completed MESSAGE
// > e.g. 10j received at seq 15 =>
// > => 4 ticks of 3j, 1j
// > => ack(14, 3j pos) x 3
// > => ack(15, 1j pos) // final ack now at 15 since 15 was finally completed
// >
// client can update player position every time it receives an ack, even if the sequence is less than the latest
// once it receives latest seq, it will also drop it and previous from the buffer
//

// processes partial actions
// on each tick: both client and server
export function processPlayerTick<
    T extends LocalWorldWrapper | ServerWorldWrapper,
>(
    ctx: T,
    player: Pick<ServerPlayer | ClientData, "actionQueue" | "lastProcessedSeq">,
    tick: number,
    handlePartialAction: ApplyActionStepFn<T>,
) {
    let stepsPerTickRemaining = MOVEMENT_CONFIG.maxCountPerTick;

    let reason: ActionResult['reason'] | ReasonRejected = undefined;
    let action: ExpandedVimAction | undefined = undefined;
    while (stepsPerTickRemaining > 0) {
        const partial = player.actionQueue.shift(); // clientTime, action, seq
        if (!partial) break;
        partial.count ??= 1;
        action = partial;

        if (partial.remaining === 0) {
            player.lastProcessedSeq = partial.seq; // update on last
            if (isBrowser) console.log(
                "~~ processing LAST action step, updating sequence::",
                partial,
                tick,
            );
        } else {
            if (isBrowser) console.log(
                `processing tick ${tick} action step::`,
                JSON.stringify(partial),
            );
        }
        reason = handlePartialAction(ctx, partial, tick);
        if (reason === "COLLISION" || reason === "OUT_OF_BOUNDS") {
            // break early, no need to replay remaining partials
            player.actionQueue.splice(0, partial.remaining);
            player.lastProcessedSeq = partial.seq; // update on last
            if (isBrowser) console.log(
                `~~ breaking early, tick ${tick} dropping remaining action steps::`,
                JSON.stringify(partial),
                {
                    queue: JSON.stringify(player.actionQueue),
                    length: player.actionQueue.length,
                },
            );
            break;
        }
        stepsPerTickRemaining -= partial.count;
    }
    return { reason, action };
}

// processes tick(s)
// hopefully used on both client and server::

const EMA_SMOOTHING = 3; // default: 2; higher prefers more recent
const EMA_INTERVAL = 60; // e.g ticks
const MULTIPLIER = EMA_SMOOTHING / (1 + EMA_INTERVAL);
const getDurationEma = buildGetEma(MULTIPLIER);

const MAX_ACTIONS_PER_TICK = 3; // in case of lag, process multiple actions in one tick
let prevEma = MOVEMENT_CONFIG.tickMs;

/** @returns a function to process 1-3 ticks per frame, typically 1 but up to 3 in case of lag */
export function setupCallTicksForPlayer<
    T extends LocalWorldWrapper | ServerWorldWrapper,
>(
    ctx: T,
    player: ServerPlayer | ClientData,
    applyActionStep: ApplyActionStepFn<T>,
    tickCompleteCallback?: (
        reason: ActionResult['reason'] | ReasonRejected ,
        action?: ExpandedVimAction,
    ) => any,
) {
    let lastTickTs = -MOVEMENT_CONFIG.tickMs; // trigger first tick immediately
    let accumulatedTime = 0;

    return function callTicks(
        ts: number,
        tickWrapper: number | { tick: number },
    ) {
        const delta = ts - lastTickTs;
        lastTickTs = ts;

        accumulatedTime += delta;

        let ticksPerFrame = 0;
        while (
            accumulatedTime >= MOVEMENT_CONFIG.tickMs &&
            ticksPerFrame < MAX_ACTIONS_PER_TICK
        ) {
            const ema = getDurationEma(
                accumulatedTime <= 5 ? MOVEMENT_CONFIG.tickMs : accumulatedTime,
                prevEma,
            );
            prevEma = ema;

            const { reason, action } = processPlayerTick(
                ctx,
                player,
                ((tickWrapper as { tick: number })?.tick ??
                    (tickWrapper as number)) + ticksPerFrame,
                applyActionStep,
            );
            tickCompleteCallback?.(reason, action);

            accumulatedTime -= MOVEMENT_CONFIG.tickMs;
            ticksPerFrame++;
        }
        console.assert(
            ticksPerFrame - 1 <= MAX_ACTIONS_PER_TICK,
            "processing many actions in tick:",
            ticksPerFrame,
        );
        if (typeof tickWrapper === "object") tickWrapper.tick += ticksPerFrame;
    };
}
