# Issue #4 — Zone Hint dismissal leaves no residue (integer Overlay Box rects)

## Goal

A dismissed Zone Hint leaves zero residual pixels on the Overlay Canvas on
every show→hide cycle, and the fps / dev-stats Overlay Boxes likewise leave no
residue when their values change length or they close. This is achieved by
rounding every Overlay Box rect at the source — floor the left/top, ceil the
right/bottom — via one shared helper, so `fillRect` and `clearRect` always
cover pixel-identical, pixel-aligned regions. Today the Zone Hint's fractional
bottom edge (`tileSize × 1.6` = 51.2 px at tileSize 32) leaves a faint ~9 %
black 1 px line after every dismissal, and the right-anchored fps box leaves a
vertical strip variant when its string length changes.

## Non-goals

- No changes to the help, help-hint, AFK, statusbar, or chunk-overlay rect
  computations. Their fractional edges are explicitly out of scope.
- No refactor of the overlay draw architecture (no new draw scheduler, no
  full-canvas-per-frame clear).
- No change to text metrics (`fontSize`, `lineHeight`, `leftPadding` stay
  fractional); only the box rect used for fill/clear is rounded.
- No viewport-resize residue handling beyond what exists today (resize is not
  part of this issue).
- No change to the zone-teaching state machine or hint dismissal triggers.

## Contracts

### Why the residue happens (invariant to preserve)

`fillRect`/`clearRect` with fractional coordinates anti-alias edge pixels.
The Zone Hint is filled once (alpha 0.55 × 0.2 coverage on the bottom row
≈ 0.11) and cleared once on dismissal (removes only 20 % of that row's alpha)
→ ~0.09 black line persists. The fps/dev-stats boxes are redrawn every frame;
their fractional left column converges to full box alpha, and when the box
width changes (fps string length) the old wider box's left columns are never
cleared → persistent vertical strip. Integer rects make fill and clear exact
complements.

### New shared helper — `src/services/draw/utils.ts`

```ts
export interface PixelRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** Round a rect outward to device pixels: floor left/top, ceil right/bottom.
 *  fillRect/clearRect over the result cover identical, pixel-aligned regions. */
export function pixelRect(
    left: number,
    top: number,
    right: number,
    bottom: number,
): PixelRect;
```

- `left`/`top` use `Math.floor`, `right`/`bottom` use `Math.ceil`.
- Integer inputs pass through unchanged.
- Negative coordinates behave normally (floor toward −∞).

### Changed rect computations — `src/services/draw/overlay.ts`

All three helpers must be **exported** (they are module-private today) so unit
tests can call them, and each must route its box rect through `pixelRect`:

1. `getZoneHintRect(viewport: Viewport, config: MapConfig): RectDimensions`
   — keeps its `{ left, top, w, h }` shape, but `left`, `top`, `left + w`,
   `top + h` are all integers. Source values: `w = tileSize * 9`,
   `h = tileSize * 1.6`, `left = (viewport.width - w) / 2`,
   `top = tileSize * 0.5`.
2. `getFpsStyles(viewport: Viewport, config: MapConfig, canvas: HTMLCanvasElement, fps: string, ema?: string): StylesWithContext`
   — returned `x`, `y`, `x + width`, `y + height` are all integers. The box is
   right-anchored (`x = viewport.width - width`), so after rounding
   `right === viewport.width` (viewport widths are integer canvas widths).
3. `getDevStatsStyles(viewport: Viewport, config: MapConfig, canvas: HTMLCanvasElement): StylesWithContext`
   — same integer-edge invariant. Its width is value-independent (derived from
   `STAT_NAME_LONGEST`), so rounding alone removes its residue.

Invariants the implementation must preserve:

- Every draw/close pair (`drawZoneHint`/`closeZoneHint`, `drawFps`/`closeFps`,
  `drawDevStats`/`closeDevStats`) computes its rect through the same helper,
  so fill and clear are pixel-identical for the same inputs.
- The scale-change paths (`hasScaleChanged` + `generateOldDimensions`) keep
  working: the old-dimension rects also flow through the helpers, so old rects
  are integer too.
- Text layout (font size, line height, padding, text positions) is unchanged;
  only the rect edges move, by < 1 px.

### fps clear must cover the previous box

Rounding alone does NOT remove the length-change strip: when the fps string
shrinks (e.g. `"60.00"` → `"4.00"`), the new narrower clear rect never covers
the old wider box's left columns. The contract therefore also requires:

- `drawFps`'s clear region must cover **both the previously drawn fps box and
  the new one** (suggested: track the last drawn `PixelRect` in a module-level
  variable in `overlay.ts` and clear the union of old and new).
- `closeFpsOnly` must clear the previously drawn box. Its current max-length
  placeholder `("00.0", "00.0")` is **shorter than real fps strings**
  (`initFpsTest` emits `toFixed(2)` values like `"60.00"`, `"120.00"`), so it
  under-covers today; replace it with the tracked last rect (or a placeholder
  at least as wide as any real value).
- `closeDevStats` needs no such union (constant width); the rounded rect is
  exactly what was drawn.

### Untouched

`generateHelpDimensions`, `drawHelpHint`'s inline rects, `getAfkRect`,
`getStatusStyles`, `CHUNK_OVERLAY` — no `pixelRect` call, no edge changes.

### Edge cases

- Integer-input rects: unchanged (no ±1 px growth).
- Odd viewport widths → fractional zone-hint `left` (e.g. `(1023 − 288) / 2 =
367.5`): floor/ceil still yields integers that contain the fractional rect.
- Fractional scale (e.g. 1.25): all three helpers produce fractional rects
  internally; `pixelRect` guarantees integer edges regardless.
- Viewport narrower than the box (negative `left`): allowed, rounded outward.

## Acceptance criteria

1. **GIVEN** fractional coordinates WHEN `pixelRect(l, t, r, b)` is called
   THEN the result has `left = Math.floor(l)`, `top = Math.floor(t)`,
   `right = Math.ceil(r)`, `bottom = Math.ceil(b)`, and integer inputs return
   unchanged.
2. **GIVEN** `getZoneHintRect` called with viewport widths 800, 1023, 1024,
   1280 at `tileSize = 32`, `scale = 1`, and again at `scale = 1.25` WHEN the
   rect is returned THEN `left`, `top`, `left + w`, `top + h` are all
   integers and the rounded rect contains the unrounded rect
   (`left ≤ origLeft`, `top ≤ origTop`, `right ≥ origRight`,
   `bottom ≥ origBottom`).
3. **GIVEN** `getFpsStyles` called with `fps ∈ {"5.00", "60.00", "120.00"}`
   (with and without `ema`) at viewport widths 800, 1023, 1280, `tileSize 32`,
   `scale 1` and `scale 1.25` WHEN the styles are returned THEN `x`, `y`,
   `x + width`, `y + height` are all integers and `x + width ===
viewport.width`.
4. **GIVEN** `getDevStatsStyles` called at viewport widths 800, 1023, 1280,
   `tileSize 32`, `scale 1` and `scale 1.25` WHEN the styles are returned
   THEN `x`, `y`, `x + width`, `y + height` are all integers.
5. **GIVEN** the fps box drawn with a 5-char fps string WHEN the value changes
   to a 4-char string THEN no pixel remains painted in the top-right region
   left of the new box's left edge (vertical strip gone). Verified by QA
   Scenario 2 (CPU throttle + strip probe).
6. **GIVEN** the Zone Hint is visible WHEN it is dismissed THEN every pixel of
   the overlay canvas inside the rounded rect
   (`left = floor((W − 288) / 2)`, `top = 16`,
   `right = ceil((W − 288) / 2 + 288)`, `bottom = ceil(16 + 51.2) = 68`,
   `W` = overlay canvas width) has alpha exactly 0. Verified by QA
   Scenario 1.
7. **GIVEN** fps + dev-stats are displayed WHEN `show.devStats` is toggled off
   THEN every pixel of the overlay canvas in region
   `x ∈ [W − 260, W)`, `y ∈ [0, 140)` has alpha exactly 0. Verified by QA
   Scenario 2 step 8.
8. **GIVEN** the final diff WHEN the help, help-hint, AFK, and statusbar rect
   computations are inspected THEN none of them call `pixelRect` and their
   rect math is byte-identical to before (reviewer diff check; automated
   proxy: `grep -n "pixelRect" src/services/draw/overlay.ts` shows call sites
   only in the zone-hint, fps, and dev-stats sections).
9. **GIVEN** the completed change WHEN `pnpm test.unit && pnpm lint &&
pnpm build.types && pnpm build` runs THEN all four commands exit 0.

## Test plan

- **Create `src/services/draw/utils.spec.ts`** (colocated with `utils.ts`):
  covers AC1 — `pixelRect` floor/ceil directions, integer passthrough,
  negative coordinates, containment of the input rect.
- **Create `src/services/draw/overlay.spec.ts`** (colocated with `overlay.ts`):
    - AC2 — `getZoneHintRect` integer edges + containment across the width /
      tileSize / scale matrix above.
    - AC3 — `getFpsStyles` integer edges, right edge flush with
      `viewport.width`, across the fps-string / width / scale matrix.
    - AC4 — `getDevStatsStyles` integer edges across the same matrix.
- **Harness details**:
    - The style helpers take an `HTMLCanvasElement` only to attach
      `canvas.getContext("2d")!` to the returned object; they never call
      methods on it during style computation. Pass a stub:
      `{ getContext: () => ({}) as CanvasRenderingContext2D }` cast as
      `HTMLCanvasElement`. No jsdom / node-canvas needed (vitest runs in node
      env per `vite.config.ts`).
    - Build `MapConfig` fixtures as object literals cast `as MapConfig`
      (interface in `src/server/map.ts`); only `tileSize`, `scale`,
      `lastScale` matter. `Viewport` literals: `{ width, height, origin: { x: 0, y: 0 } }`.
    - Pure-function entry points: `pixelRect`, `getZoneHintRect`,
      `getFpsStyles`, `getDevStatsStyles` (all exported by this change). No
      fake timers needed; nothing reads the clock.
    - AC5/AC6/AC7 are canvas-pixel behaviors owned by the QA station's
      Playwright run (below); do not attempt them in vitest.

## QA plan

Boot: `pnpm dev --port 5199 --strictPort`, base URL
`http://localhost:5199`. Throwaway harness at `qa-artifacts/qa-run.ts`
(Playwright config with `testMatch` on it, `reuseExistingServer: false`,
chromium, viewport 1280×720). **One browser context / one page is enough** —
this is a single-player rendering check; no multiplayer pairing needed.
Login flow (same as `e2e/intro.spec.ts`): goto `/canvas1`, fill
`#username`, click Submit, poll
`__vimworld.client.isReady && __vimworld.client.lastAckCheckpoint` (20 s).
Press keys one at a time with ~100 ms gaps. Fresh server = fresh world (chest
not yet emptied). All probes read
`document.querySelector('canvas[data-name="overlay"]')` and use
`getContext("2d").getImageData(...)`; `W` = that canvas's `width` attribute
(scrollbars may make it ≠ 1280, so never hardcode).

### Scenario 1 — Zone Hint show → dismiss → zero residue (AC6)

1. Login as `qa-residue-4`. Walk to the room-3 chest: press
   `1 7 l w 2 l w 2 l w 2 l 9 l k`; poll `__vimworld.client.player.pos`
   equals `{ x: 40, y: 8 }`.
2. Poll `__vimworld.client.zoneHintText` matches `/take the key/i` (10 s).
3. Screenshot `qa-artifacts/zone-hint-visible.png`.
4. Probe A (hint painted): compute
   `left = Math.floor((W - 288) / 2)`, `top = 16`,
   `right = Math.ceil((W - 288) / 2 + 288)`, `bottom = 68`;
   `getImageData(left, top, right - left, bottom - top)`; assert the pixel at
   `(left + 5, top + 4)` has alpha > 100 (hint background present).
5. Dismiss for real: press `y`, `i`, `"` (yank the key → auto-dismiss); poll
   `__vimworld.client.zoneHintText === ""` (10 s); wait 300 ms for the close
   frame.
6. Probe B: same `getImageData`; assert **every** pixel has `alpha === 0`.
7. Screenshot `qa-artifacts/zone-hint-dismissed.png`.

### Scenario 2 — fps / dev-stats vertical residue (AC5, AC7)

1. Same page (dev overlay is on by default: `show.devStats = true`). Wait 2 s
   so the fps box has settled (≈ `"60.00"`, 5 chars).
2. Force a value-length change via CDP:
   `const cdp = await page.context().newCDPSession(page);`
   `await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 })`; wait 4 s
   (fps drops below 10 → string shrinks to 4 chars → box narrows → a buggy
   build leaves the old wider box's left columns painted).
3. fps strip probe (AC5): region `x ∈ [W − 260, W)`, `y ∈ [0, 50)`. On row 25,
   scan left from column `W − 1` while alpha > 0; let `L` be the first column
   left of that run. Assert `L > W − 260` (box found) and every pixel in
   columns `[W − 260, L − 1]` has `alpha === 0`.
4. dev-stats strip probe: same algorithm on row 100, region `y ∈ [54, 140)`.
5. Screenshot `qa-artifacts/fps-devstats-throttled.png` clipped to
   `{ x: W - 260, y: 0, width: 260, height: 140 }`.
6. Un-throttle: `cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })`.
7. Close the boxes: `page.evaluate(() => { (window as any).__vimworld.show.devStats = false })`;
   wait 300 ms.
8. Close probe (AC7): `getImageData(W - 260, 0, 260, 140)`; assert every
   pixel has `alpha === 0`.
9. Screenshot `qa-artifacts/devstats-closed.png` (same clip).

Evidence: 4 screenshots (≤ 6 allowed). Every numbered probe above is a
Playwright assertion, not a human eyeball.

## Risks

- **The issue text attributes the fps length-change strip to rounding alone;
  rounding cannot fix it** (a narrower new clear rect never covers the old
  wider box). The contract therefore adds the last-rect/max-rect clear for
  `drawFps`/`closeFpsOnly`. If the reviewer reads the issue as "rounding only,
  nothing else", AC5 will fail — this interpretation is the spec author's call.
- `closeFpsOnly`'s current placeholder `("00.0", "00.0")` is shorter than real
  fps strings (`toFixed(2)` → `"60.00"`, `"120.00"`), so it under-covers
  today; the fix must widen or replace it or AC7 fails.
- dev-stats width is value-independent (`STAT_NAME_LONGEST`), so its
  "value length changes" case is a no-op; the vertical-strip risk is fps-only.
  The dev-stats probe still guards against regressions.
- Scenario 2's length change assumes headless fps starts ≥ 10 (5-char string).
  On an extremely slow runner the baseline may already be 4 chars; the probe
  still passes but exercises less. The strip assertions hold either way.
- The zone-hint dismissal path (yank the key) needs a fresh world; QA boots
  its own dev server with `reuseExistingServer: false`, so this is satisfied.
- `tileSize` is read live from `__vimworld.world.config.tileSize` (32 today);
  the probe formulas use `t = tileSize`, `w = 9t`, `h = 1.6t` rather than
  hardcoded 288/51.2 if the config ever changes.

STATUS: READY
