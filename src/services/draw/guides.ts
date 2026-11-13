import { GameState } from "~/hooks/useState";
import {
    getViewportCoordsAsPx,
    isWithinViewport,
} from "~/simulation/shared/helpers";

/**
 * Static guide figures — a standing person at each zone boundary of the Phase 0
 * intro map. Pure visual anchor + quiet presence (no animation, no AI; the
 * animated NPC is Phase 0.5+). They render on the players canvas, which is
 * cleared and redrawn exactly when the camera moves, so they move with the
 * camera with no trail and no extra redraw cost.
 */

/** world-tile positions, one per landmark, just before it on the corridor (y=10) */
export const ZONE_GUIDES: Array<{ x: number; y: number }> = [
    { x: 6, y: 10 }, // before the gap — "hop"
    { x: 11, y: 10 }, // before the chest — "take the key"
    { x: 19, y: 10 }, // before the keyhole — "place the key"
    { x: 25, y: 10 }, // before the door — the far side
];

export function drawGuides(state: GameState, ctx: CanvasRenderingContext2D) {
    const { tileSize, scale } = state.ctx.world.config;
    const { viewport } = state.ctx.client;

    for (const g of ZONE_GUIDES) {
        const worldPx = { x: g.x * tileSize, y: g.y * tileSize };
        const { px, py } = getViewportCoordsAsPx(worldPx, viewport.origin);
        if (!isWithinViewport(viewport, { px, py })) continue;
        drawGuideFigure(ctx, px, py, tileSize, scale);
    }
}

const GUIDE_BODY_COLOR = "#7E57C2";
const GUIDE_HEAD_COLOR = "#FFECB3";

/** a simple standing figure: round head + rounded body, centered in the tile */
function drawGuideFigure(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tileSize: number,
    scale: number,
) {
    const cx = x + tileSize / 2;
    const headR = tileSize * 0.16 * scale;
    const headCy = y + tileSize * 0.26;
    const bodyTop = y + tileSize * 0.44;
    const bodyBottom = y + tileSize * 0.92;
    const bodyHalfW = tileSize * 0.22 * scale;

    // body (rounded rect)
    ctx.fillStyle = GUIDE_BODY_COLOR;
    roundRect(
        ctx,
        cx - bodyHalfW,
        bodyTop,
        bodyHalfW * 2,
        bodyBottom - bodyTop,
        headR,
    );
    ctx.fill();

    // head
    ctx.fillStyle = GUIDE_HEAD_COLOR;
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();
}

/** platform-independent rounded rect (avoids the not-everywhere fillRectRounded) */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
