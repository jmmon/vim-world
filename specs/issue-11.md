# Issue #11 — Canvas backing store resized on column/line changes

## Goal

When the map's column or line count changes — via `:set columns=N` / `:set
lines=N` or the menu zoom — the four stacked canvases (map, objects, players,
overlay) get their backing-store `width`/`height` attributes updated to match
`client.viewport.width`/`height`, so the canvas is never stretched by the CSS
size change. Any Overlay Box that was visible before the resize is redrawn
(redraw, not pixel-preservation, matching the existing scale-change precedent
`hasScaleChanged` / `generateOldDimensions`), so the help, help hint, Zone
Hint, and AFK boxes reappear at the new size instead of vanishing with the
cleared backing store.

## Non-goals

- No browser-window resize handling (no `ResizeObserver` exists; none is
  added).
- No `devicePixelRatio` support: backing store stays 1 CSS px = 1 canvas px,
  exactly as the JSX initial values do today.
- No visible-chunk recompute on column change. `chunkService` is not notified
  by the `:set columns` path; that latent gap is a separate issue.
- No pixel-preservation of overlay content across a resize (no
  `drawImage` snapshot of the old bitmap).
- No change to the statusbar, fps, or dev-stats draw cadence — they repaint
  every frame and self-heal after a resize without help.
- No change to `:set` validation limits (columns/lines stay clamped to
  `max(10, sidescrolloff+1)`–100 / `max(10, scrolloff+1)`–100 in
  `src/simulation/client/command.ts`).

## Contracts

### Root cause (context, do not re-fix)

`viewport.updateCanvas` (`src/simulation/client/viewport.ts`,
`updateCanvasDimensions`) only assigns CSS `style.width/height` on the
container and the four canvases. The backing-store attributes are set once in
JSX (`src/components/canvas1/canvas1.tsx`) and Qwik never re-runs the
component body, so they are frozen at the SSR values. Both `:set
columns/lines` (`src/simulation/client/command.ts` → `viewport.updateDimensions`)
and menu zoom (`src/components/menu/menu.tsx` → `handlers.updateScale`)
change `client.viewport.width/height`, and every call site marks `map` dirty,
so `renderMap()` → `viewport.updateCanvas(state)` runs — but only the CSS
size follows, stretching the bitmap.

### `src/simulation/client/types.ts` — `ClientData`

```ts
export type ClientData = {
    // ... existing fields unchanged ...
    /** One-shot: set when a canvas backing store was actually resized;
     *  consumed (cleared) by the render loop to repaint persistent Overlay Boxes. */
    needsOverlayRepaint: boolean;
};
```

`src/hooks/useState.ts` initializes `needsOverlayRepaint: false` in the
`client` object literal (next to `isDirty`).

### `src/simulation/client/viewport.ts` — `updateCanvasDimensions`

Signature unchanged: `viewport.updateCanvas(state: GameState): void`.
Behavior after the existing CSS style assignments:

- For each of the four canvases (`refs.map`, `refs.objects`, `refs.players`,
  `refs.overlay`): assign `canvas.width = viewport.width` only if
  `canvas.width !== viewport.width`; assign `canvas.height = viewport.height`
  only if `canvas.height !== viewport.height`.
  - The guard is load-bearing: assigning `canvas.width`/`canvas.height`
    clears the canvas bitmap even when the value is unchanged, so unchanged
    dimensions must produce zero assignments.
- If at least one assignment happened on any canvas, set
  `state.ctx.client.needsOverlayRepaint = true`.
- The container `div` keeps CSS-only sizing (no backing store).
- Existing CSS style assignments stay exactly as they are.

Invariant after any `updateCanvas` call: for each of the four canvases,
`canvas.width === client.viewport.width && canvas.height ===
client.viewport.height` (backing store equals CSS size, 1:1).

### `src/hooks/useRenderLoop.ts` — `render()`

Consume the flag at the end of `render()`: after the `isDirty` redraw block
(so the resize performed by `renderMap()` in the same frame is followed by
the overlay repaint in that same frame) and before the trailing
`state.ctx.world.config.lastScale = state.ctx.world.config.scale`
assignment:

```
if (state.ctx.client.needsOverlayRepaint) {
    state.ctx.client.needsOverlayRepaint = false;
    // re-run the showing-transition-driven Overlay Boxes and sync trackers
    renderHelp();      wasHelpShowing = state.ctx.show.help;
    renderAfk();       wasAfkShowing = state.ctx.show.afk;
    renderZoneHint();  wasZoneHintShowing = state.ctx.show.zoneHint;
                       wasZoneHintText = state.ctx.client.zoneHintText;
    if (state.ctx.show.helpHint) draw.helpHint(state);
}
```

- `renderHelp`/`renderAfk`/`renderZoneHint` already branch on the current
  `show` flag (draw when showing, close when not), so re-running them is
  idempotent: `close*` on a freshly cleared canvas is a harmless `clearRect`.
- Syncing the `was*` trackers prevents the transition blocks at the top of
  the next `render()` from drawing the same boxes a second time.
- Help hint is also redrawn by `renderMap()` in the resize frame (it runs
  after `updateCanvas` there); the flag handler's redraw is idempotent
  (`drawHelpHint` clears its own rect first).
- Statusbar, fps, and dev stats are drawn earlier in `render()` and are
  wiped by the resize; they self-heal on the next frame because they repaint
  unconditionally. A one-frame absence at 60 fps is accepted.

### `src/services/draw/overlay.ts` — help-box dimension cache staleness

`getHelpDimensions` memoizes `generateHelpDimensions` into the module-level
`HELP_DIMENSIONS` record keyed by `config.tileSize` **only**. `:set
columns` / `:set lines` change the viewport while `tileSize` stays constant,
so the cache returns the pre-resize rect and the flag handler's
`renderHelp()` would redraw the help box at the old width/height — the
Goal's "reappear at the new size" fails silently, and a band that the old
rect also covers cannot detect it.

Contract: **delete the `HELP_DIMENSIONS` cache.** `drawHelp` calls
`generateHelpDimensions(state.ctx.client.viewport, config)` directly (pure
arithmetic; `closeOldHelp` already calls it uncached). Do not replace it with
a wider cache key. Invariant: every Overlay Box rect is derived from the live
`client.viewport` at draw time — no dimension memo may key on less than the
full rect inputs.

### Call paths that must work unchanged

- `:set columns=40` → `updateSetting` → `viewport.updateDimensions` returns
  `isDirty: true` → `handlers.updateIsDirty` marks all four dirty →
  `render()` → `renderMap()` → `updateCanvas` resizes backing stores, map /
  objects / players redraw in-frame, flag repaints overlay boxes.
- Menu zoom → `handlers.updateScale` + `handlers.markAllDirty` → same path
  (plus the existing `lastScale !== scale` → `draw.clearAll` behavior,
  untouched).
- Initial loop start (`viewport.updateCanvas(state)` before the rAF loop):
  backing stores already equal the JSX values, so no assignment, no flag, no
  spurious repaint.
- `:set columns=<same value>` → `setClientSetting` returns `false` → not
  dirty → `renderMap`/`updateCanvas` never run → no resize, no clear.

### Edge cases / error behavior

- Refs are non-null by the time `updateCanvas` runs (it is only called from
  the client `useVisibleTask$`); keep the existing `!` dereference style.
- A resize where only width or only height differs must assign only the
  differing attribute.
- `needsOverlayRepaint` is strictly one-shot: set only on an actual
  assignment, cleared by the consumer before the redraw.

## Acceptance criteria

1. GIVEN a `GameState` stub whose four canvas stubs have `width`/`height`
   attributes different from `ctx.client.viewport.width/height`, WHEN
   `viewport.updateCanvas(state)` is called, THEN every canvas's `width`
   attribute equals `viewport.width` and every canvas's `height` attribute
   equals `viewport.height`, and `ctx.client.needsOverlayRepaint === true`.
2. GIVEN canvas stubs whose `width`/`height` attributes already equal the
   viewport dimensions, WHEN `viewport.updateCanvas(state)` is called, THEN
   zero `width`/`height` assignments occur (observable via setter spies) and
   `needsOverlayRepaint` stays `false`.
3. GIVEN a stub where only the width differs, WHEN `updateCanvas` is called,
   THEN width attributes are assigned, height attributes are not assigned,
   and `needsOverlayRepaint === true`.
4. GIVEN any `updateCanvas` call, THEN the existing CSS behavior is
   preserved: container and all four canvases get `style.width`/
   `style.height` equal to `viewport.width + "px"` / `viewport.height +
   "px"`.
5. GIVEN the `/canvas1` page is loaded and the player is ready, WHEN the
   user types `:set columns=40<CR>`, THEN `__vimworld.client.settings.columns
   === 40` and the overlay canvas element's `width` attribute equals
   `__vimworld.client.viewport.width` exactly. Integer invariant: on the
   `:set` path `viewport.width = columns × tileSize` with both factors
   integers, so viewport dims and canvas attributes are exact integers — no
   rounding anywhere.
6. GIVEN the same page, WHEN the user types `:set lines=20<CR>`, THEN the
   overlay canvas element's `height` attribute equals
   `__vimworld.client.viewport.height` exactly (same integer invariant:
   `lines × tileSize`).
7. GIVEN the same page after a column change, THEN the overlay canvas is not
   stretched: its `width` attribute equals its CSS layout width in px
   (`getBoundingClientRect().width`), i.e. backing store and CSS size agree.
8. GIVEN the help Overlay Box is open (`:help`), WHEN the user then types
   `:set columns=40<CR>` and waits a few frames, THEN the overlay canvas has
   non-zero alpha pixels inside the help Overlay Box rect computed from the
   post-resize viewport — the `generateHelpDimensions` region: `left =
   tileSize * 0.5`, `top = viewport.height − 8.5 * tileSize`, `w =
   viewport.width − tileSize`, `h = 8 * tileSize` — sampled **only within the
   top 75 % of that rect's height** (`getImageData(left, top, w, h * 0.75)`).
   The region scoping is load-bearing: the statusbar Overlay Box repaints
   unconditionally every frame and overlaps the help rect's bottom 0.5 tiles
   (`y = viewport.height − statusHeight` vs help bottom `viewport.height −
   0.5 * tileSize`), so whole-rect or whole-canvas alpha would pass even when
   the help-box redraw is broken. The top 75 % band is strictly inside the
   help fill (`rgba(0,0,0,0.4)` over the full rect → alpha > 0) and strictly
   above the statusbar (statusbar height = `2 × 16 × scale` px = 32 px at
   scale 1; band bottom sits 2.5 tiles = 80 px above the canvas bottom, so no
   overlap across the menu zoom range), so non-zero alpha there proves the
   help box itself was redrawn after the backing-store clear.
9. GIVEN the same state as criterion 8 (help open at the default 32 columns,
   then widened to 40), THEN the overlay canvas **also** has non-zero alpha
   in a sub-region only the post-resize rect covers: x from `newRight −
   tileSize` to `newRight`, where `newRight = viewport.width − 0.5 *
   tileSize`, y within the same top-75 % band (`getImageData(newRight −
   tileSize, top, tileSize, h * 0.75)`). Widening 32 → 40 columns moves the
   rect's right edge 8 tiles, so a redraw at stale cached dimensions (the
   `HELP_DIMENSIONS` bug) leaves that rightmost 1-tile strip transparent and
   fails this assertion.

## Test plan

### Unit — `src/simulation/client/viewport.spec.ts` (new)

Covers criteria 1–4. Stub style follows `src/services/draw/overlay.spec.ts`
(cast minimal objects through `as unknown as …`). `updateCanvasDimensions`
dereferences `state.refs.{container,map,objects,players,overlay}.value!.style`
and reads/writes `state.ctx.client.viewport` / `needsOverlayRepaint` — the
stub must cover exactly that surface:

- Canvas stub factory: a plain object with `style: {}` and `width`/`height`
  number fields wrapped in `set`/`get` accessors counting assignments (or
  `vi.fn` setters), cast to `HTMLCanvasElement`.
- Refs stubs are Qwik-signal-shaped: `map` / `objects` / `players` /
  `overlay` entries are `{ value: canvasStub() }`; the `container` entry is
  `{ value: { style: {} } }` (a div — no backing store).
- `ctx` stub: `{ client: { viewport: { origin: { x: 0, y: 0 }, width,
  height }, needsOverlayRepaint: false } }`.
- No fake timers, no DOM, no fixtures beyond the stub factory; the function
  under test is `viewport.updateCanvas` (pure over the stub).

Behaviors: all-differ → attrs set + flag true (AC1); all-equal → zero
assignments + flag stays false (AC2); width-only-differs (AC3); CSS style
strings on container and all four canvases (AC4). Red-tier note: AC2 and AC4
are guard tests — current code already passes them (today there are no
backing-store assignments at all, so "zero assignments when equal" and the
CSS behavior hold trivially); the red→green cycle applies to AC1 and AC3.
The tester must not force AC2/AC4 artificially red.

### E2E — `e2e/canvas-resize.spec.ts` (new)

Covers criteria 5–9. Harness follows `e2e/intro.spec.ts`: login via
`#username` + Submit, poll `__vimworld.client.isReady &&
client.lastAckCheckpoint`, fresh dev server (in-memory world). Helper to run
an ex-command: press `:`, type the command text one key at a time with the
intro spec's 100 ms inter-key gap, press `Enter`, then `expect.poll` on
`__vimworld.client.settings`. Assertions via
`page.locator('canvas[data-name="overlay"]')` attribute reads and a
`page.evaluate` that compares `canvas.width` to
`getBoundingClientRect().width` (criteria 5–7). Criteria 8–9 use
**region-scoped** sampling: in `page.evaluate`, read the live
`__vimworld.client.viewport` and `world.config.tileSize` after the resize,
compute the help rect (`left = tileSize * 0.5`, `top = viewport.height −
8.5 * tileSize`, `w = viewport.width − tileSize`, `h = 8 * tileSize`), then
`getImageData(left, top, w, h * 0.75)` on the overlay canvas and require a
non-zero alpha count — never sample the whole canvas or the full help rect
(the statusbar band at the rect's bottom would mask a broken help redraw).
For criterion 9, additionally sample the new-rect-only strip
`getImageData(newRight − tileSize, top, tileSize, h * 0.75)` with `newRight =
viewport.width − 0.5 * tileSize` and require non-zero alpha there — a
stale-cached-dimensions redraw at the pre-resize width fails it. The
criteria 8–9 sequence must start from the default 32 columns: reload the
page (or `:set columns=32`) before opening help, otherwise `:set
columns=40` after criterion 5 is a no-op and 8–9 pass vacuously. Single
browser context; no multiplayer.

## QA plan

Boot: the QA station runs `pnpm dev --port 5199 --strictPort` and drives the
steps below manually / via its runner at `http://localhost:5199/canvas1`.
The automated `e2e/canvas-resize.spec.ts` runs separately under the existing
`playwright.config.ts` (baseURL 5173, `reuseExistingServer`) via
`pnpm test.e2e` — two runners, no conflict. One browser context
(single-player). Fresh dev server per run so no stale checkpoint moves the
player.

1. Type username `qa-resize`, click Submit. Wait until
   `window.__vimworld.client.isReady` is truthy (dev hook).
   Expected: four stacked canvases render the intro map, statusbar visible.
2. Record baseline: `document.querySelector('canvas[data-name="overlay"]')
   .width` equals `__vimworld.client.viewport.width`.
   Expected: equal (initial backing store matches viewport).
3. Press `:`, type `set columns=40`, press `Enter`. Wait ~300 ms.
   Expected: `__vimworld.client.settings.columns === 40`; overlay canvas
   `width` attribute equals `__vimworld.client.viewport.width` exactly
   (= 40 × tileSize, an integer); the canvas is not stretched —
   `canvas.width` equals
   `getBoundingClientRect().width`; map and statusbar render at the new
   width with no smearing (Playwright: attribute + bounding-box equality).
4. Press `:`, type `set lines=20`, press `Enter`. Wait ~300 ms.
   Expected: overlay canvas `height` attribute equals
   `__vimworld.client.viewport.height` exactly (= 20 × tileSize); CSS height
   equals backing-store height.
5. Press `:`, type `help`, press `Enter` (opens the help Overlay Box), wait
   ~300 ms; then press `:`, type `set columns=60`, press `Enter`, wait
   ~300 ms.
   Expected: non-zero alpha pixels inside the help Overlay Box rect computed
   from the post-resize viewport (`left = tileSize*0.5`, `top =
   viewport.height − 8.5*tileSize`, `w = viewport.width − tileSize`, `h =
   8*tileSize`), sampled with `getImageData(left, top, w, h * 0.75)` — the
   top-75 % band only, so the every-frame statusbar band overlapping the
   rect's bottom cannot fake a pass. Additionally sample the new-rect-only
   strip `getImageData(newRight − tileSize, top, tileSize, h * 0.75)`
   (`newRight = viewport.width − 0.5 * tileSize`): widening 40 → 60 columns (step 3 left columns at 40)
   moves the right edge 20 tiles, so a help redraw at stale cached
   dimensions leaves that strip transparent. Non-zero alpha in both regions
   proves the help box was redrawn at the post-resize rect after the resize
   cleared the backing store.
6. Press `:`, type `help`, press `Enter` to close; press `ctrl+[` to open the
   menu, change Scale, submit. Expected: canvases stay unstretched (same
   attribute-vs-bounding-box equality as step 3).

## Risks

- The issue text says the columns limit is "10–100"; the code clamps to
  `max(10, sidescrolloff + 1)`–100, i.e. 11–100 with the default
  `sidescrolloff = 10`. Tests use 40/60/20, safely inside both readings; no
  behavior change is requested.
- Visible chunks are not recomputed on a column change (explicitly out of
  scope), so after widening, map tiles beyond the old chunk set may stay
  blank until the next scroll/dirty event. QA steps stay within the already
  visible area to avoid asserting on that separate gap.
- One-frame absence of statusbar/fps right after a resize is inherent to the
  agreed consume-at-end design (they repaint unconditionally the next frame);
  do not "fix" it by moving the statusbar draw.
- Assigning `canvas.width` clears the bitmap: any future caller of
  `updateCanvas` outside a dirty-map path would blank the map canvas. The
  guard plus the flag are the mitigation; the invariant is documented above.

STATUS: READY
