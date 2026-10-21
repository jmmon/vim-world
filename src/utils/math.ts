/** exponential moving average helper; higher smoothing prefers more recent values */
export function buildGetEma(multiplier: number) {
    return (curFps: number, prevFps: number) =>
        curFps * multiplier + prevFps * (1 - multiplier);
}