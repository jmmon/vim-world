import { Direction, Tile, TileType } from "~/types/worldTypes";
import { DIMENSIONS } from "../components/canvas1/constants";

const CHANCE = {
    dirt: 0.05,
    cliff: 0.05,
    water: 0.1,
}

function buildTile(type: TileType): Tile {
    return {
        type,
        collision: { solid: !WALKABLE.includes(type) },
    };
}
export const WALKABLE: TileType[] = ["grass", "dirt"];
const INITIAL_MAP: Tile[][] = Array.from({ length: DIMENSIONS.height }, () =>
    Array.from({ length: DIMENSIONS.width }, () => {
        const random = Math.random();
        let chance = CHANCE.cliff;
        if (random < chance) return buildTile("cliff");
        chance += CHANCE.dirt;
        if (random < chance) return buildTile("dirt");
        chance += CHANCE.water;
        if (random < chance) return buildTile("water");
        return buildTile("grass");
    }),
); 

const SPREAD_CHANCE = {
    water: 0.5,
    dirt: 0.25,
    cliff: 0.25,
    grass: 0.05,
};
type Data = {
    count: number;
    dir: Array<Direction>;
}
function spread() {
    for (let y = 0; y < DIMENSIONS.height; y++) {
        for (let x = 0; x < DIMENSIONS.width; x++) {
            const nearbyTiles = {
                N: INITIAL_MAP[y - 1]?.[x] || undefined,
                W: INITIAL_MAP[y][x + 1] || undefined,
                E: INITIAL_MAP[y][x - 1] || undefined,
                S: INITIAL_MAP[y + 1]?.[x] || undefined,
            }

            const nearbyTypes = Object.entries(nearbyTiles).reduce((accum, [dir, cur]) => {
                if (!cur) return accum;
                accum[cur.type] = {
                    count: (accum[cur.type]?.count || 0) + 1,
                    dir: [...(accum[cur.type]?.dir || []), dir as Direction ],
                };
                return accum;
            }, {} as Record<TileType, Data>);
            const typesEntries = Object.entries(nearbyTypes);
            const sortedKeys = typesEntries.sort((a, b) => b[1].count - a[1].count) as [TileType, Data][];
            const highest = sortedKeys[0];
            const lowest = sortedKeys[sortedKeys.length - 1]; 
            const avgCount = sortedKeys.reduce((accum, cur) => accum + cur[1].count, 0) / sortedKeys.length;
            let avg = highest;
            let total = 0;
            for (let i = 0; i < sortedKeys.length; i++) {
                const {count} = sortedKeys[i][1];
                total += count;
                if (total >= avgCount) {
                    avg = sortedKeys[i];
                    break;
                }
            }


            // const allHighest = filtered.every((v) => v === highest[0]);
            // if (allHighest) {
            //     INITIAL_MAP[y][x] = highest[0];
            //     return;
            // }

            const random = Math.random();
            const spreadChance = SPREAD_CHANCE[highest[0]]

            const highestTile = buildTile(highest[0]);
            if (random < spreadChance) {
                INITIAL_MAP[y][x] = highestTile;
                console.assert(INITIAL_MAP[y][x].type === highestTile.type, 'Spread failed:', {highest, current: INITIAL_MAP[y][x]});
            }

            const avgTile = buildTile(avg[0]);

            // TODO: attempt to reduce the number of stragglers
            const random2 = Math.random();
            if (random2 > 0.95) {
                if (lowest[1].dir.includes('N')) {
                    INITIAL_MAP[y - 1][x] = avgTile;
                } else if (lowest[1].dir.includes('E')) {
                    INITIAL_MAP[y][x + 1] = avgTile;
                } else if (lowest[1].dir.includes('W')) {
                    INITIAL_MAP[y][x - 1] = avgTile;
                } else if (lowest[1].dir.includes('S')) {
                    INITIAL_MAP[y + 1][x] = avgTile;
                }
            }
        }
    }
}

export function generateMap(spreadCount: number = 7) {
    for (let i = 0; i < spreadCount; i++) {
        spread();
    }
    // console.log([...map]);
    return INITIAL_MAP;
}

export const MAP = generateMap();


