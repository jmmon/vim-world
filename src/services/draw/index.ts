import { drawOffscreenMap, drawVisibleMap } from "./map";
import { drawObjects } from "./objects";
import { closeAfk, closeDevStats, closeHelp, drawAfk, drawDevStats, drawFps, drawHelp, drawHelpHint, drawStatus } from "./overlay";
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
    statusbar: drawStatus,

    devStats: drawDevStats,
    closeDevStats: closeDevStats,
}
export default draw;


