import { DIMENSIONS, HOT_PINK } from "~/components/canvas1/constants";
import { map } from "~/components/canvas1/map";
import { MapObject, Player, TileType, Vec2, World } from "~/components/canvas1/types";
import { getRandomHexColor } from "~/components/canvas1/utils";
import { isWalkable, isWithinBounds } from "~/fsm/movement";

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


export type ClientData = {
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

// const DIRECTIONS: Player["dir"][]  = ["N", "S", "E", "W"];
// const SPAWN_POSITION: Vec2 = {x: 0, y: 0};
// const getRandom = (max: number) => Math.floor(Math.random() * max);
// function getRandomPosition() {
//     const x = getRandom(DIMENSIONS.width);
//     const y = getRandom(DIMENSIONS.height);
//     return { x, y };
// }
// function generatePlayer(id: string, TEST_isFirst: boolean): Player {
//     if (TEST_isFirst) return { id: id,
//         pos: SPAWN_POSITION,
//         dir: "E",
//         color: HOT_PINK,
//     };
//
//     return {
//         id,
//         pos: getRandomPosition(),
//         dir: DIRECTIONS[getRandom(DIRECTIONS.length)],
//         color: getRandomHexColor(),
//     };
// }

const otherPlayers: Player[] = [
    { id: "1", pos: { x: 10, y: 10 }, dir: "E", color: getRandomHexColor(), lastProcessedSeq: -1 },
    { id: "2", pos: { x: 11, y: 11 }, dir: "N", color: getRandomHexColor(), lastProcessedSeq: -1 },
    { id: "3", pos: { x: 12, y: 12 }, dir: "S", color: getRandomHexColor(), lastProcessedSeq: -1 },
];
const player: Player = {
    id: "abc",
    pos: { x: 0, y: 0 },
    dir: "E",
    color: HOT_PINK,
    lastProcessedSeq: -1
};

export const WORLD: World & {
    isWithinBounds(target: Vec2): boolean;
    isWalkable(target: Vec2): boolean;
} = {
    dimensions: DIMENSIONS,
    map: map,
    player: player,
    otherPlayers: [...otherPlayers],
    objects,
    walkable: WALKABLE, // dont really like this here, but there are also other changes for server worldstate
    help: { // not needed on server state, client only
        isOpen: false,
    },
    isWithinBounds(target: Vec2) {
        return isWithinBounds(this, target);
    },
    isWalkable(target: Vec2) {
        return isWalkable(this, target);
    },
};






// TODO:
// proper user creation and management
// # eventual goal: use dash username to create a user on the dash network
// - load into server memory, send to client
//
// # for now: all in memory
// - create user in server memory, send to client
// - client can save the playerId into localStorage for persistance
// - on page reload, use localStorage.getItem('playerId') and send to server to load player (or create a new one if it doesn't exist e.g. server restart)
//
//
// this will provide actual generation and logging in flow for the server worldstate, which can be adapted to Dash once that is integrated
// - instead of using the hard-coded `player`, will always be the players[] and have to find the player in there by id and then apply the actions
//
//
//
// dash flow:
// client:
// 1. connect wallet extension
// 2. sends a getCharacter(someDashId) request to server => existingChar | newChar (DASH call to check for character/player document)
// server:
// - server saves char into server memory world state (add char to the players[], broadcast the new character to other players so they see him online)
// - sends worldstate with player (and other players) to client
//
//
//
// temp localStorage flow:
// client:
// 1: check localStorage for existing character (playerId or whatever)
// - else generate a new playerId and save to localStorage
// 2. send a getCharacter(playerId) request to server => existingChar | newChar (from server memory) (server player cache separate from online world cache!)
// server:
// - server saves char into world state, broadcast new login to other players
// - sends worldstate to client
//
//
// so: split calls for map/world and players
// load map first, can render map and show a login (username) modal
// after submitting, can create/fetch the user




// IDEA:
// unlock more keybinds??
// e.g. start with hjkl, maybe x (delete) or f (find)
// - unlock wb to jump over obstacles
// start with ya' ya[ ya` (no shift required)
// expand to ya{ ya( ya" (shift required))
// ya(, ya", ya[, ya{, ya', ya` yank around whatever - kinda complex command but used to pick up items of different "types" e.g. paren/quote/braket items
// - maybe some of them could be unlocked later, more item types
// 
