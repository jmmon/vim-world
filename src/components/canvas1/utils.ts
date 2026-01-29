import crypto from "node:crypto";

const EMA_SMOOTHING = 3; // default: 2; higher prefers more recent
const EMA_INTERVAL = 5; // e.g seconds
const MULTIPLIER = EMA_SMOOTHING / (1 + EMA_INTERVAL);

const getEma = (curFps: number, prevFps: number) =>
    curFps * MULTIPLIER + prevFps * (1 - MULTIPLIER);


export function initFpsTest(zero = 0) {
    let lastTs = zero;
    let frames = 0;
    let prevEma = 0;
    let ema = 0;

    return function coutFps(ts: number) {
        frames++;
        if (ts - lastTs > 1000) {
            const normalized = frames * 1000 / (ts - lastTs);
            frames = 0;
            lastTs = ts;

            if (prevEma === 0) prevEma = normalized;
            ema = getEma(normalized, prevEma);
            prevEma = normalized;

            return {
                fps: Number(normalized.toFixed(2)),
                ema: Number(ema.toFixed(2))
            };
        }
    }
}

export const getRandomHSLColor = (text: string = crypto.randomUUID()) => {
    return stringToHSLColor(text, {min: 20, max: 90}, {min: 20, max: 90});
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
    for (let i = 0; i < string.length; i++) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return hash < 0 
        ? hash * -1 
        : hash;
};
// export const hashStringToHex = (fn: (string: string) => number, string: string) => fn(string).toString(16);
//
// export const cyrb53 = (seed = 0) => (str: string) => {
//     let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
//     for(let i = 0, ch; i < str.length; i++) {
//         ch = str.charCodeAt(i);
//         h1 = Math.imul(h1 ^ ch, 2654435761);
//         h2 = Math.imul(h2 ^ ch, 1597334677);
//     }
//     h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
//     h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
//     h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
//     h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
//   
//     return 4294967296 * (2097151 & h2) + (h1 >>> 0);
// };
// export const cyrb64 = (seed = 0) => (str: string) => {
//     let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
//     for(let i = 0, ch; i < str.length; i++) {
//         ch = str.charCodeAt(i);
//         h1 = Math.imul(h1 ^ ch, 2654435761);
//         h2 = Math.imul(h2 ^ ch, 1597334677);
//     }
//     h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
//     h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
//     h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
//     h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
//   
//     return (h2>>>0).toString(16).padStart(8, '0') + (h1>>>0).toString(16).padStart(8, '0');
//     // return 4294967296 * (2097151 & h2) + (h1 >>> 0);
// };

// const hasher = crypto.createHash('sha256');
// export const serverHash$ = server$((str: string) => 
//   crypto.createHash('sha256').update(str).digest('hex')
// )

// async function test() {
//   let str = '';
//   console.log('hashing compares:')
//   for (let i = 0; i <= 20; i++) {
//     const noSeed = hashStringToHex(cyrb53(), str);
//     const hashSeed = hashStringToHex(cyrb53(stringToHash(str)), str)
//     const hash64 = cyrb64()(str);
//     const hash64Seed = cyrb64(stringToHash(str))(str);
//     const hash = await serverHash(str);
//     // const hash2 = await generateHash(str);
//     console.log({
//         noSeed: {length: noSeed.length, hash: noSeed},
//         hashSeed: {length: hashSeed.length, hash: hashSeed},
//         hash64: {length: hash64.length, hash: hash64},
//         hash64Seed: {length: hash64Seed.length, hash: hash64Seed},
//         hash: {length: hash.length, hash: hash},
//         // hash2: {length: hash2.length, hash: hash2},
//     });
//
//     str += 'a';
//   }
// }
// test();

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
