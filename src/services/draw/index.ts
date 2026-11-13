import { drawOffscreenMap, drawVisibleMap, initOffscreenCanvas } from "./map";
import { drawObjects } from "./objects";
import {
    closeAfk,
    closeDevStats,
    closeHelp,
    closeZoneHint,
    drawAfk,
    drawChunkOverlay,
    drawDevStats,
    drawFps,
    drawHelp,
    drawHelpHint,
    drawStatus,
    drawZoneHint,
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

    zoneHint: drawZoneHint,
    closeZoneHint,

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
