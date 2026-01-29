import { DIMENSIONS } from "~/components/canvas1/constants";
import { MAP } from "~/server/map";
import { Player, Vec2 } from "~/components/canvas1/types";
import { isWalkable, isWithinBounds } from "~/fsm/movement";
import { WALKABLE, objects } from "./objects";
import { ClientData, ServerWorld, ServerWorldWrapper } from "./types";


export const clients = new Map<string, ClientData<undefined | 'withPlayerId'>>();

const players = new Map<string, Player>();

export const SERVER_WORLD: ServerWorld = {
    dimensions: DIMENSIONS,
    map: MAP,
    players,
    objects,
    walkable: WALKABLE, // for collision
}
export const WORLD_WRAPPER: ServerWorldWrapper = {
    world: SERVER_WORLD,
    isWithinBounds(target: Vec2) {
        return isWithinBounds(this.world.map, target);
    },
    isWalkable(target: Vec2) {
        return isWalkable(this.world, target);
    },
    /**
     * set player into world.players
     * */
    addPlayer(player: Player) {
        if (!player) return false;
        try {
            const pos = player.pos;
            while (!this.isWalkable(pos) || (
                !this.isWalkable({ x: pos.x, y: pos.y + 1 })
                && !this.isWalkable({ x: pos.x, y: pos.y - 1 })
                && !this.isWalkable({ x: pos.x + 1, y: pos.y })
                && !this.isWalkable({ x: pos.x - 1, y: pos.y })
            )) {
                const isAtRight = pos.x === this.world.dimensions.width - 1;
                const isAtBottom = pos.y === this.world.dimensions.height - 1;
                if (isAtBottom && isAtRight) {
                    throw new Error('!!no walkable tiles found!!');
                }
                if (isAtRight) {
                    pos.x = 0;
                    pos.y += 1;
                } else {
                    pos.x += 1;
                }
            }

            this.world.players.set(player.id, player);
            console.log('added player:', player);
            return true;
        } catch(err) {
            console.error('addPlayer error:', err);
            return false;
        }
    }
};











// export const WORLD: World & {
//     isWithinBounds(target: Vec2): boolean;
//     isWalkable(target: Vec2): boolean;
// } = {
//     dimensions: DIMENSIONS,
//     map: MAP,
//     player: player,
//     players: [...otherPlayers],
//     objects,
//     walkable: WALKABLE, // dont really like this here, but there are also other changes for server worldstate
//     help: { // not needed on server state, client only
//         isOpen: false,
//     },
//     isWithinBounds(target: Vec2) {
//         return isWithinBounds(this, target);
//     },
//     isWalkable(target: Vec2) {
//         return isWalkable(this, target);
//     },
// };






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


/* *
 * so: 
 * 1. on load:
 * - fetch the world map, obstacles, etc
 * - render the map without any players
 *
 * 2. after initial load:
 * 2.a. show Username popup
 * 2.b. fetch/render online players
 * 
 * 2.c. submit username to server
 * - POST request with the hash
 * - check for player in cache,
 *   - if not found, create player in cache
 * - return the player to client
 * - client renders the player (hides modal)
 *
 * 3. log out:
 * - find player in cache, mark as logged out or removed from world
 * - broadcast logout to other players: {
 *       type: 'LOGOUT',
 *       playerId: player.id
 *   }
 * - client receives this request, removes that player from localWorld
 *   - now it will not be rendered
 * 
 * client:
 * - localWorld: make players a map<PlayerId, Player> for easy removing
 * server: 
 * - need to maintain all characters in a map in memory
 * - need to maintain a list of logged-in players or playerIds
 *
 * so the server state:
 * - world holds players map, these are players logged-in
 * - checkpoints is basically the dash network cache, to look up an offline char and allow them to log in
 *
 */





// IDEA:
// unlock more keybinds??
// e.g. start with hjkl, maybe x (delete) or f (find)
// - unlock wb to jump over obstacles
// start with ya' ya[ ya` (no shift required)
// expand to ya{ ya( ya" (shift required))
// ya(, ya", ya[, ya{, ya', ya` yank around whatever - kinda complex command but used to pick up items of different "types" e.g. paren/quote/braket items
// - maybe some of them could be unlocked later, more item types
// 
//
// maybe some powerup items: +1 to range while equipped??

// is this going to be a puzzle game only or will it be some combat game?? (hp)
//
// later: 
// data stored in dash network: could be some sort of encoded data?? compressed? to reduce the payload size??
//
//
//
// =========================================
//      TOAST:
// =========================================
// some sort of toast message? circle on left, squared on right, maybe some icon on left circle + text on right
// not sure what for, but could come in handy
//
//
//
// =========================================
//      MAPS:
// =========================================
// hard-coded starter maps e.g. tutorial maps (a few levels or so)
// - item to get extra xp??
// by the end, should be level 2 or 2.5ish (if they picked up items)
// some sort of bonus points for using counts (if counts got you to the target, e.g. something interactable is within +-1 block)
//
//
//
// =========================================
//      INTERACTION:
// =========================================
// first need to implement ya( to pick up items
//
// carry items overhead and place them again??? keybinds for this??? y then p
// - sometimes need to do pi( to specifically place, maybe this could also place diagonally
//
// - e.g. pick up a box and place on some switchplate??
//
//
//
// TODO:
// =========================================
//      other ideas:::
// =========================================
// `<leader>g` to open some diff for the session? (lazygit)
// `-` to open something (oil.nvim)
// some command input line e.g. typing `:` shows the line, and each additional char is also shown until command is submitted
// and/or something like screenkey
// also `/` or `?` should do similar, for string search find/replace (only in certain views?? inventory view - could it be useful in the map view??? maybe to locate some target)
//
// some sort of statusbar to show the mode, coords, command, keys, search?
//
// havent even thought about visual or insert modes!
// insert: maybe have some sort of q and a: user inserts the answer
// could `ci"` or `ci(` or `ca"` etc?
//
// would Inventory be a modal or a canvas overlay?
// 
//
//
//
//
//
//
//
//
//
