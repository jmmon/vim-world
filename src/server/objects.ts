import { MAP } from "~/server/map";
import { MapObject, TileType } from "~/components/canvas1/types";

const objectsList: MapObject[] = [
    { type: "tree", pos: { x: 0, y: 0 }, walkable: false },
    { type: "chest", pos: { x: 0, y: 0 }, walkable: true },
];

export const WALKABLE: TileType[] = ["grass", "dirt"];
// const WALKABLE_MAP_TILES = map.
// want to get a list of all coordinates that are walkable:
const WALKABLE_MAP_TILES = MAP.reduce(
    (accum, row, y) => {
        row.forEach((tile, x) => {
            if (WALKABLE.includes(tile)) {
                accum.push({ x, y });
            }
        });
        return accum;
    },
    [] as { x: number; y: number }[],
);

// randomizing positions
export const objects = objectsList.map((obj) => {
    const random = Math.floor(Math.random() * WALKABLE_MAP_TILES.length);
    const { x, y } = WALKABLE_MAP_TILES[random];
    console.assert(
        !!WALKABLE_MAP_TILES[random],
        "error indexing walkable map tiles!",
    );
    return {
        ...obj,
        pos: {
            x,
            y,
        },
    };
});

