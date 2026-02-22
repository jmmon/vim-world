import { DIMENSIONS, zone } from "~/server/map";
import { ClientData, World, ServerWorldWrapper } from "./types";
import { Player, Vec2 } from "~/types/worldTypes";
import { isWalkable, isWithinBounds } from "~/simulation/shared/helpers";
import { pickUpItem, pickUpObject } from "~/simulation/shared/actions/interact";
import { findObjectInRangeByKey } from "~/simulation/shared/validators/interact";
import { entities } from "./objects";
import { SERVER_PHYSICS } from "./physics";

export const clients = new Map<string, ClientData<undefined | 'withPlayerId'>>();
const players = new Map<string, Player>();

export const SERVER_WORLD: World = {
    dimensions: DIMENSIONS,
    zone: zone,
    players,
    entities: entities,
}
export const WORLD_WRAPPER: ServerWorldWrapper = {
    world: SERVER_WORLD,
    physics: SERVER_PHYSICS,
    isWithinBounds(target: Vec2) {
        return isWithinBounds(this, target);
    },
    isWalkable(target: Vec2) {
        return isWalkable(this, target);
    },
    /**
     * set player into world.players
     * */
    addPlayer(player: Player) {
        if (!player) return false;
        try {
            // shift pos if not walkable
            const pos = player.pos;
            while (!this.isWalkable(pos) || (
                !this.isWalkable({ x: pos.x, y: pos.y + 1 })
                && !this.isWalkable({ x: pos.x, y: pos.y - 1 })
                && !this.isWalkable({ x: pos.x + 1, y: pos.y })
                && !this.isWalkable({ x: pos.x - 1, y: pos.y })
            )) {
                const isAtRight = pos.x === this.world.dimensions.worldWidthBlocks - 1;
                const isAtBottom = pos.y === this.world.dimensions.worldHeightBlocks - 1;
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
    },

    findObjectInRangeByKey: findObjectInRangeByKey,

    // ya: maybe need a "carry" slot on player; put the itemId in the "carry" slot, remove its position while carried?
    pickUpObject: pickUpObject,
    // yi: I guess remove the itemId from the object and add it to the player's items
    pickUpItem: pickUpItem,
    // pa
    // placeObject: placeObject,
    // pi
    // placeItem: placeItem,
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
// throwing some more ideas...
// inventory:: flow:
//
// maybe :vs[plit] to open inventory??? ctrl+w ctrl+l/h to switch focus
//
// picking up items would just append it to the inventory's next slot
// to place an item, open inventory and navigate to it and delete it `da(` or something, which saves it to the register
// then switch focus to the world and `pa(` to paste
//
// ~~ letters as items? rarity based on dvorak layout (e.g. most used letters rank highest)
//
//
//
//
//





// Okay, about the maps::
// I should allow an "open" world, or at least multiple chunks e.g. 4x4 chunks +
// I think I want to be able to walk between chunks smoothly with camera panning as you move to keep you centered??
// - or might be more vim-like to transition once you get to the edge of the chunk... that way your cols/rows aren't always changing?? maybe doesn't matter
//
// and then I do want a first few levels hard-coded as tutorials.
// e.g. some dungeon where you find the key and unlock the door to escape
// and then some other stories to progress to some other actions??
//
// so I would also want some sort of map object to show which actions are available at which levels
// perhaps individuals could also unlock extra actions
//
// maybe some actions are unlockable if you already know vim
// and other actions would be restricted until you reach certain checkpoints
//
//
// might want some target glowing object/circle as a destination point
//
// still want to do inventory of some sort, open some screen where you can navigate your inventory with vim commands
// maybe pick up an item from inventory to place or use, or equip??
//



// Ok so i want to have settings for rowOffset and colOffset (set to 8 for example to keep 8 rows and 8 cols on screen before cursor hits edge)
// - if set to 0, pan one chunk at a time once the user goes past the edge
// else pan one movement amount once they get to the limit e.g. 8 away from the edge
//
// I guess I could render a 9x9 grid of chunks offscreen, then pan across them
// always keep up to 9 buffered



