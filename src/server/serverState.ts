import { DIMENSIONS, HOT_PINK, getRandomHexColor } from "~/components/canvas1/constants";
import { map } from "~/components/canvas1/map";
import { MapObject, Player, TileType, World } from "~/components/canvas1/types";

// type Item = any;
// type ItemId = string;
// type SessionAggregate = {
//     xpGained: number;
//     goldGained: number;
//     itemsAdded: Item[];
//     itesmRemoved: ItemId[];
//     achievementsUnlocked: string[];
// }
// type ServerPlayer = {
//     x: number;
//     y: number;
//     zone: string;
//     facing: 'N' | 'S' | 'E' | 'W'
//     session: SessionAggregate;
// }
// const players = new Map<string, ServerPlayer>();
//
// export type ServerState = {
//     dimensions: MapDimensions;
//     map: TileType[][];
//     players: Map<string, ServerPlayer>;
//     objects: MapObject[],
// };
//
// export const SERVER_WORLD = {
//     dimensions: DIMENSIONS,
//     map: [[]],
//     players: players,
//     objects: [],
// }


type ClientData = {
    ws: any;
    lastMessageTime: number;
    isAfk: boolean;
    playerId: string;
};
export const clients = new Map<string, ClientData>();




const objectsList: MapObject[] = [
    { type: "tree", pos: { x: 0, y: 0 }, walkable: false },
    { type: "chest", pos: { x: 0, y: 0 }, walkable: true },
];

export const WALKABLE: TileType[] = ["grass", "dirt"];
// const WALKABLE_MAP_TILES = map.
// want to get a list of all coordinates that are walkable:
const WALKABLE_MAP_TILES = map.reduce(
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

const objects = objectsList.map((obj) => {
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
// objects.sort((a, b) => a.y - b.y); // Draw lower objects later for depth
//

const otherPlayers: Player[] = [
    { id: "1", pos: { x: 10, y: 10 }, dir: "E", color: getRandomHexColor() },
    { id: "2", pos: { x: 11, y: 11 }, dir: "N", color: getRandomHexColor() },
    { id: "3", pos: { x: 12, y: 12 }, dir: "S", color: getRandomHexColor() },
];
const player: Player = {
    id: "abc",
    pos: { x: 0, y: 0 },
    dir: "E",
    color: HOT_PINK,
};

export const WORLD: World = {
    dimensions: DIMENSIONS,
    map: map,
    player: player,
    otherPlayers: [...otherPlayers],
    objects,
    walkable: WALKABLE, // dont really like this here, but there are also other changes for server worldstate
    help: {
        isOpen: false,
    },
};
