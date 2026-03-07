import { drawOffscreenMap, drawVisibleMap, initOffscreenCanvas } from "./map";
import { drawObjects } from "./objects";
import {
    closeAfk,
    closeDevStats,
    closeHelp,
    drawAfk,
    drawChunkOverlay,
    drawDevStats,
    drawFps,
    drawHelp,
    drawHelpHint,
    drawStatus,
} from "./overlay";
import { drawPlayers } from "./players";
import { clearAll } from "./utils";

const draw = {
    // players
    players: drawPlayers,

    // objects
    objects: drawObjects,

    // maps
    initOffscreenDimensions: initOffscreenCanvas,
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
    chunkOverlay: drawChunkOverlay,

    clearAll: clearAll,
};
export default draw;

