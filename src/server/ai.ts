// for testing:
// simple movement for other players
//
// idea: each tick, initiate a move action
// small chance to change direction, otherwise keep the same direction
// small chance to do w/b?

import { ServerOtherPlayerMessage } from "~/types/messageTypes";
import { Direction, Player } from "~/types/worldTypes";

// import { HOT_PINK } from "~/components/canvas1/constants";
// import { getRandomHSLColor } from "~/components/canvas1/utils";

const directions: Direction[] = [
    'N',
    'S',
    'E',
    'W',
];

const DIR_CHANGE_CHANCE = 0.2;

// TODO:
export function createMoveActionRandom(player: Player): ServerOtherPlayerMessage<"MOVE"> {
    const random = Math.random();
    // const count = Math.ceil((random * 2) ** 2);
    let dir = player.dir;
    switch(true) {
        case(random > 1 - DIR_CHANGE_CHANCE):
            // change direction; don't break;
            const dirIndex = Math.floor((random - (1 - DIR_CHANGE_CHANCE)) * (1 / DIR_CHANGE_CHANCE * 4)) // 0-3
            dir = directions[dirIndex];
            // fallthrough
        case(random > 0.75):
        break;
        case(random > 0.5):
        break;
        default:
        break;
    }
    const moveMessage: ServerOtherPlayerMessage<"MOVE"> = {
        type: "PLAYER",
        subtype: "MOVE",
        playerId: player.id,
        pos: player.pos,
        dir: player.dir,
    }

    return moveMessage;
}


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

// export const otherPlayers: Player[] = [
//     { name: '1', id: "1", pos: { x: 10, y: 10 }, dir: "E", zone: 'default', color: getRandomHSLColor(), lastProcessedSeq: -1 },
//     { name: '2', id: "2", pos: { x: 11, y: 11 }, dir: "N", zone: 'default', color: getRandomHSLColor(), lastProcessedSeq: -1 },
//     { name: '3', id: "3", pos: { x: 12, y: 12 }, dir: "S", zone: 'default', color: getRandomHSLColor(), lastProcessedSeq: -1 },
// ];
// export const player: Player = {
//     name: 'abc',
//     id: "abc",
//     pos: { x: 0, y: 0 },
//     dir: "E",
//     zone: 'default',
//     color: HOT_PINK,
//     lastProcessedSeq: -1
// };


