import { roundToDecimals } from "~/utils/utils";
import { buildGetEma } from "~/utils/math";

const EMA_SMOOTHING = 3; // default: 2; higher prefers more recent
const EMA_INTERVAL = 5; // e.g seconds
const MULTIPLIER = EMA_SMOOTHING / (1 + EMA_INTERVAL);

export function initFpsTest(zero = 0, decimals = 2) {
    let lastTs = zero;
    let frames = 0;
    let prevEma = 0;
    let ema = 0;
    const getEma = buildGetEma(MULTIPLIER);

    return function coutFps(
        ts: number,
    ): undefined | { fps: string; ema: string } {
        frames++;
        if (ts - lastTs > 1000) {
            const normalized = (frames * 1000) / (ts - lastTs);
            frames = 0;
            lastTs = ts;

            if (prevEma === 0) prevEma = normalized;
            ema = getEma(normalized, prevEma);
            prevEma = normalized;

            return {
                fps: roundToDecimals(normalized, decimals).toFixed(decimals),
                ema: String(roundToDecimals(ema, decimals - 1)),
            };
        }
    };
}