const EMA_SMOOTHING = 3; // default: 2; higher prefers more recent
const EMA_INTERVAL = 5; // e.g seconds
const MULTIPLIER = EMA_SMOOTHING / (1 + EMA_INTERVAL);

const getEma = (curFps: number, prevFps: number) =>
    curFps * MULTIPLIER + prevFps * (1 - MULTIPLIER);

function roundToDecimals(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return (Math.round(value * factor) / factor)
        .toFixed(decimals) // consistent decimal places
        .padStart(3 + decimals, " "); // consistent full string width
}

export function initFpsCounter(zero: number, decimals = 1) {
    let frameCount = 0;
    let elapsed = 0;
    let last = zero;
    let fps = "".padStart(3 + decimals, " ");

    let prevEma = "0";
    let ema = "0";

    function countFps (ts: number) {
        // counting frames...
        frameCount++;
        const duration = ts - last;
        elapsed += duration;

        if (elapsed >= 1000) {
            const fpsRaw = frameCount / (elapsed / 1000);
            fps = roundToDecimals(fpsRaw, decimals);
            frameCount = 0;
            elapsed = 0;
            last = ts;

            const prevValue = Number(prevEma) || fpsRaw; // use raw for prev on init
            const emaRaw = getEma(fpsRaw, prevValue);
            ema = roundToDecimals(emaRaw, decimals);
            prevEma = ema;
        }
        return { fps, ema };
    };
    return countFps;
}
