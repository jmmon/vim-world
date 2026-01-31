const ROUND_TO_DECIMALS_MIN = 0;
const ROUND_TO_DECIMALS_MAX = 4;
export function roundToDecimals(value: number, decimals: number = 2) {
    if (decimals < ROUND_TO_DECIMALS_MIN) decimals = ROUND_TO_DECIMALS_MIN;
    if (decimals > ROUND_TO_DECIMALS_MAX) decimals = ROUND_TO_DECIMALS_MAX;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}



