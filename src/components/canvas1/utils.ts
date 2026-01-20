const EMA_SMOOTHING = 3; // default: 2; higher prefers more recent
const EMA_INTERVAL = 5; // e.g seconds
const MULTIPLIER = EMA_SMOOTHING / (1 + EMA_INTERVAL);

const ema = (curFps: number, prevFps: number) =>
    curFps * MULTIPLIER + prevFps * (1 - MULTIPLIER);

function roundToDecimals(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return (Math.round(value * factor) / factor)
        .toFixed(decimals) // consistent decimal places
        .padStart(3 + decimals, " "); // consistent full string width
}

export function initFpsCounter(decimals = 1) {
    let count = 0;
    let total = 0;
    let last = performance.now();
    let fps = "".padStart(3 + decimals, " ");

    let prevFpsEma = "0";
    let fpsEma = "0";

    return () => {
        // counting frames...
        count++;
        const now = performance.now();
        total += now - last;

        if (total >= 1000) {
            // trigger calculation
            const fpsRaw = count / (total / 1000);
            fps = roundToDecimals(fpsRaw, decimals);
            count = 0;
            total = 0;
            last = now;

            const prevValue = Number(prevFpsEma) || fpsRaw; // use raw for prev on init
            fpsEma = roundToDecimals(ema(fpsRaw, prevValue), decimals);
            prevFpsEma = fpsEma;
        }
        return { fps, fpsEma };
    };
}
