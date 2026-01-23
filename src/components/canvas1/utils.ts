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


export const getRandomHexColor = (text: string = crypto.randomUUID()) => {
    return stringToHSLColor(text, {min: 20, max: 90}, {min: 20, max: 90});
    // const letters = "0123456789ABCDEF";
    // let color = "#";
    // const LIMIT = 4;
    // for (let i = 0; i < 6; i++) {
    //     color += letters[Math.floor(Math.random() * (16 - LIMIT)) + LIMIT];
    // }
    // return color;
};

const stringToHSLColor = (
  string: string,
  saturation = { min: 20, max: 80 },
  lightness = { min: 30, max: 80 },
) => {
  // max unique colors: 360 * (saturation.max - saturation.min) * (lightness.max - lightness.min)
  // 360 * 80 * 60 = 1_728_000

  const hash = stringToHash(string);
  const satHash = stringToHash(numberToString(hash));
  const lightHash = stringToHash(numberToString(satHash + hash));

  const satPercent = satHash % 100;
  const lightPercent = lightHash % 100;

  const hue = hash % 360;
  const sat = Math.round(
    saturation.min +
      (Number(satPercent) * (saturation.max - saturation.min)) / 100,
  );
  const light = Math.round(
    lightness.min +
      (Number(lightPercent) * (lightness.max - lightness.min)) / 100,
  );

  return `hsla(${hue}, ${sat}%, ${light}%, 1)`;
};

export const stringToHash = (string: string) => {
  let hash = 0;
  for (const char of string) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0; // Constrain to 32bit integer
  }
  return hash;
};

// const stringToHash = (string: string) => {
//   let hash = 0;
//   for (let i = 0; i < string.length; i++) {
//     hash = string.charCodeAt(i) + ((hash << 5) - hash);
//     hash = hash & hash;
//   }
//   return hash < 0 
//         ? hash * -1 
//         : hash;
// };

const numberToString = (number: number) => {
  let numberAsStr = String(number);
  let result = "";
  while (numberAsStr.length > 1) {
    const thisChar = String.fromCharCode(Number(numberAsStr.slice(-2)));
    numberAsStr = numberAsStr.slice(0, -2);
    result += thisChar;
  }
  return result;
};
