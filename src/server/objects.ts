import { MAP } from "~/server/map";
import { Item, MapObject, TileType } from "~/types/worldTypes";

export const items: Item[] = [
    { quality: 'rare', id: "123", type: "item", name: "item", description: "description" },
    { quality: 'common', id: "456", type: "item", name: "item2", description: "description2" },
];

const objectsList: MapObject[] = [
    {
        type: "tree",
        pos: {
            x: 0,
            y: 0
        },
        walkable: false,
        liftable: false,
    }, {
        type: "chest",
        target: '"',
        pos: {
            x: 0,
            y: 0
        },
        walkable: false,
        liftable: true,
        itemIds: ['123']
    }, {
        type: "item",
        target: '[',
        pos: {
            x: 0,
            y: 0
        },
        walkable: true,
        liftable: true,
        itemIds: ['456']
    },
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


