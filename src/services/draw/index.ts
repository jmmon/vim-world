import { drawOffscreenMap, drawVisibleMap } from "./map";
import { drawObjects } from "./objects";
import { closeAfk, closeHelp, drawAfk, drawFps, drawHelp, drawHelpHint } from "./overlay";
import { drawPlayer, drawPlayers } from "./players";

const draw = {
    // players
    players: drawPlayers,
    player: drawPlayer,

    // objects
    objects: drawObjects,

    // maps
    offscreenMap: drawOffscreenMap,
    visibleMap: drawVisibleMap,

    // overlays
    help: drawHelp,
    closeHelp,

    afk: drawAfk,
    closeAfk,

    fps: drawFps,
    helpHint: drawHelpHint,
}
export default draw;
