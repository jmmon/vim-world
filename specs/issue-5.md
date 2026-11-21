# Issue #5 — Zone Hint verb updates on zone transition; canvas text state restored

## Goal

When the player crosses into a new Zone while the Zone Hint is showing, the
Overlay Canvas immediately redraws the box with the new zone's Verb instead of
keeping the previous zone's verb until the hint happens to toggle off. And
because `drawZoneHint` restores the canvas text state (`textAlign` /
`textBaseline`) it mutates, every other Overlay Canvas text — the statusbar
"Mode: Normal" label and the help hint — renders at its correct position after
any Zone Hint cycle. Today the render loop's redraw trigger watches only the
show/hide edge (zone x-ranges are contiguous, so a zone change while showing
flips only the Verb text), and the leaked `textBaseline = "middle"` shifts the
statusbar text ~5 px and the leaked `textAlign = "center"` spills help-hint
text left of its clear rect.

## Non-goals

- No changes to the zone-teaching state machine (`stepZoneTeaching`): entry
  flash duration, sit-then-nudge timing, and dismissal triggers stay exactly as
  they are. The fix is purely in the redraw trigger and the draw function.
- No text-state save/restore in any other overlay draw (`drawAfk` also leaks
  `textAlign = "center"`, `drawFps`/`drawDevStats` set `textAlign = "left"`).
  Only `drawZoneHint` is required to restore. `players.ts` sets
  `textBaseline` on the separate players canvas — untouched, no interaction.
- No changes to `drawStatus`, `drawHelpHint`, or any rect geometry (the
  integer-rect work from #4 has landed: `pixelRect` exists in
  `src/services/draw/utils.ts` and `getZoneHintRect` already routes through it).
- No redraw scheduler, no full-canvas-per-frame repaint.
- No viewport-resize handling.

## Contracts

### 1. New pure redraw predicate — `src/hooks/useZoneTeaching.ts`

```ts
/** True when the Zone Hint overlay must be redrawn this frame: the box
 *  appeared/disappeared OR the Verb text changed while (possibly) showing.
 *  Zone x-ranges are contiguous, so a zone transition while showing changes
 *  only the text — watching the visibility edge alone leaves a stale verb. */
export function zoneHintNeedsRedraw(
    prevShowing: boolean,
    prevText: string,
    showing: boolean,
    text: string,
): boolean;
```

- Returns `prevShowing !== showing || prevText !== text`. Pure, no state.
- Lives in `useZoneTeaching.ts` (the Zone Hint's home module, already
  vitest-importable — `useZoneTeaching.spec.ts` imports it today).

### 2. Render loop wiring — `src/hooks/useRenderLoop.ts`

Inside the `useVisibleTask$` closure (current lines 106–145):

- Add `let wasZoneHintText = state.ctx.client.zoneHintText;` next to
  `wasZoneHintShowing`.
- Replace the condition
  `needsRedrawZoneHint = wasZoneHintShowing !== state.ctx.show.zoneHint;`
  with
  `needsRedrawZoneHint = zoneHintNeedsRedraw(wasZoneHintShowing, wasZoneHintText, state.ctx.show.zoneHint, state.ctx.client.zoneHintText);`
  (import from `~/hooks/useZoneTeaching`).
- After `renderZoneHint()` runs, update **both** `wasZoneHintShowing` and
  `wasZoneHintText` to the current values.
- No other loop behavior changes.

Edge behavior (must hold, all handled by existing `renderZoneHint`):

- Verb change while hidden (`show=false`, text `"" → ""` or any change):
  predicate may fire; `renderZoneHint` takes the `closeZoneHint` branch —
  clearing an already-clear rect is harmless.
- Show edge with unchanged text: redraw (clear + fill + text) is idempotent;
  issue #4's integer rects guarantee no residue.
- Both edges change at once (zone entry from hidden): one redraw.

### 3. Text-state restore — `src/services/draw/overlay.ts` `drawZoneHint`

Current code (lines 484–501) sets `ctx.textAlign = "center"` and
`ctx.textBaseline = "middle"` and never restores them. Contract:

- Capture `const prevAlign = ctx.textAlign; const prevBaseline = ctx.textBaseline;`
  before mutating them; restore both after `fillText` (restore on every path
  that mutated them; the `if (!verb) return` early-return happens before any
  mutation, so nothing to restore there).
- **Invariant:** after `drawZoneHint(state)` returns, `ctx.textAlign` and
  `ctx.textBaseline` equal their values at entry. During the verb `fillText`
  they are `"center"` / `"middle"` (centered verb is intended).
- Why this fixes the neighbors: `drawStatus` sets `textAlign` per call but
  never sets `textBaseline` (relies on the default `"alphabetic"`; leaked
  `"middle"` at baseline `y = d.y + fontSize − 2` drops the glyph bottoms
  below the skyblue mode box, reading as a ~5 px shift). `drawHelpHint` sets
  neither (relies on defaults; leaked `"center"` spills its text left of the
  clear rect). The Zone Hint is the only overlay-canvas draw that mutates
  `textBaseline`.

### 4. Data the QA harness reads (dev-only, already exposed)

- `window.__vimworld` (set in `canvas1.tsx` under `import.meta.env.DEV`):
  `client.zoneHintText`, `client.player.pos`, `client.isReady`,
  `client.lastAckCheckpoint`, `show.*`.
- Overlay canvas: `document.querySelector('canvas[data-name="overlay"]')`;
  `W`/`H` = its `width`/`height` attributes (never hardcode 1280/720).
- Zone Hint rect at tileSize 32, scale 1 (post-#4, integer):
  `left = Math.floor((W − 288) / 2)`, `top = 16`, `w = 288`,
  `bottom = Math.ceil(16 + 51.2) = 68`.
- Intro map zones (`src/server/map.ts`): room1 x 0–15 verb
  `"Move with h j k l"`, room2 x 16–31 verb `"Hop gaps with w"`; spawn is
  `(2, 8)`; row 8 is walkable from x 2 to x 19.
- Statusbar geometry (tileSize 32, scale 1): box top `d.y = H − 32`; mode box
  (`"Mode: Normal"`, skyblue fill, black text) spans `y ∈ [H − 32, H − 16]`,
  `x ∈ [3.6, ~141]`; text baseline `H − 18`.

## Acceptance criteria

1. GIVEN the hint is showing with verb A WHEN neither visibility nor verb
   changed (`zoneHintNeedsRedraw(true, "A", true, "A")`) THEN it returns
   `false` (same zone, same verb → no redraw).
2. GIVEN the hint is showing with verb A WHEN the player crosses into a new
   zone so the verb becomes B while still showing
   (`zoneHintNeedsRedraw(true, "A", true, "B")`) THEN it returns `true`.
3. GIVEN the hint is showing with verb A WHEN it hides
   (`zoneHintNeedsRedraw(true, "A", false, "")`) THEN it returns `true`
   (close path still fires).
4. GIVEN the hint is hidden with empty text WHEN nothing changed
   (`zoneHintNeedsRedraw(false, "", false, "")`) THEN it returns `false`.
5. GIVEN a 2D context stub with `textAlign = "left"`,
   `textBaseline = "alphabetic"` WHEN `drawZoneHint` draws a non-empty verb
   THEN the recorded `fillText` call saw `textAlign === "center"` and
   `textBaseline === "middle"`, AND after the call both properties are
   restored to `"left"` / `"alphabetic"`.
6. GIVEN the same stub WHEN `drawZoneHint` is called with
   `zoneHintText === ""` THEN `fillText` is never called and both properties
   are unchanged.
7. QA (headless, one page): GIVEN the Zone Hint is showing room1's verb
   (sit-then-nudge at spawn) WHEN the player walks east across the x=16
   boundary THEN a per-frame pixel sampler over the Zone Hint rect records
   at least one non-empty frame after the crossing whose pixel hash differs
   from the room1-verb baseline (the new verb was drawn while showing), and
   the final frames are empty (hint closed); and a screenshot after the
   room2 nudge shows the text "Hop gaps with w".
8. QA (headless): GIVEN a fresh login WHEN a full Zone Hint show→close cycle
   has completed THEN every black text pixel of the statusbar band
   (`x ∈ [4, 140]`, `y ∈ [H − 40, H)`) lies within the mode box rows
   `y ≤ H − 16` (no ~5 px shift/spill below the box), and black text pixels
   exist inside the box.
9. GIVEN the completed change WHEN `pnpm test.unit && pnpm lint &&
pnpm build.types && pnpm build` runs THEN all four commands exit 0.

## Test plan

- **Extend `src/hooks/useZoneTeaching.spec.ts`** (colocated; module already
  imported there, no new harness):
    - AC1–AC4 — truth table for `zoneHintNeedsRedraw`: showing+same text →
      false; showing+text change → true; hide edge → true; hidden steady →
      false. Pure function, no fixtures needed beyond booleans/strings.
- **Extend `src/services/draw/overlay.spec.ts`** (colocated; reuse its
  `viewport()` / `config()` fixture helpers):
    - AC5, AC6 — `drawZoneHint` text-state restore with a recording fake ctx:
      a plain object with writable `textAlign`/`textBaseline`/`font`/
      `fillStyle` fields and `vi.fn()` `clearRect`/`fillRect`/`fillText`;
      `fillText` records `{ textAlign, textBaseline }` at call time. Stub
      state: `{ refs: { overlay: { value: canvasStub } }, ctx: { world: {
config: { tileSize: 32, scale: 1, lastScale: 1 } }, client: { viewport:
{ width: 1280, height: 720, origin: { x: 0, y: 0 } }, zoneHintText:
"Hop gaps with w" } } } as unknown as GameState`, where `canvasStub`
      returns the fake ctx from `getContext("2d")`.
    - AC4 unit proxy (optional guard): after a `drawZoneHint` +
      `closeZoneHint` cycle on the same fake ctx, `drawStatus`'s recorded
      `fillText` coordinates are identical to a standalone `drawStatus` call.
    - No fake timers; nothing reads the clock. No jsdom/node-canvas (vitest
      node env; the fake ctx replaces all canvas behavior).
- AC7, AC8 are canvas-pixel behaviors owned by the QA station's Playwright
  run below; do not attempt them in vitest.

## QA plan

Boot: `pnpm dev --port 5199 --strictPort`, base URL `http://localhost:5199`.
Throwaway harness at `qa-artifacts/qa-run.ts` (Playwright config with
`testMatch` on it, `reuseExistingServer: false`, chromium, viewport 1280×720
— the fresh server guarantees a fresh world). **One browser context / one
page** — single-player rendering check, no multiplayer pairing. Login (same
as `e2e/intro.spec.ts`): goto `/canvas1`, fill `#username` with
`qa-zonehint-5`, click Submit, poll `__vimworld.client.isReady &&
__vimworld.client.lastAckCheckpoint` (20 s). Press keys one at a time with
~100 ms gaps. All probes read
`document.querySelector('canvas[data-name="overlay"]')` and use
`getContext("2d").getImageData(...)`; `W`/`H` = that canvas's `width`/
`height` attributes.

### Scenario 1 — verb swaps mid-show on boundary crossing (AC7)

1. Login. Idle ~3.5 s; poll `__vimworld.client.zoneHintText` matches
   `/Move with h j k l/` (sit-then-nudge at spawn, hint showing).
2. Screenshot `qa-artifacts/zone-hint-zone0.png` clipped to the Zone Hint
   rect (`left = floor((W−288)/2)`, `top = 16`, `288×52`).
3. Install a per-frame sampler via `page.evaluate`: an rAF loop that each
   frame runs `getImageData(left, 16, 288, 52)` over the Zone Hint rect,
   pushes `{ nonEmpty: <any pixel alpha > 0>, hash: <sum of r+g+b+a over
every 4th pixel> }` onto `window.__qaSamples`, and stops on a flag.
   The dev overlays (fps top-right, chunk box top-left) do not intersect the
   centered rect.
4. Record the baseline hash (mean of the first ~10 samples; the canvas is
   static while the nudge shows).
5. Walk east across the boundary: press `l` 14 times (spawn x=2 → x=16);
   poll `__vimworld.client.player.pos` equals `{ x: 16, y: 8 }`. The hint
   stays showing room1's verb during the walk (stuck-nudge persists in-zone).
6. Poll `__vimworld.client.zoneHintText === ""` (5 s) — the hint closes on
   the frame after zone entry (teaching machine hides unless stuck).
7. Stop the sampler; assert on the samples taken after the last `l`:
   (a) at least one sample has `nonEmpty === true` AND
   `hash !== baselineHash` — the new verb was drawn while the box was
   showing (pre-fix every post-crossing non-empty frame equals the baseline:
   the stale room1 verb); (b) the last 3 samples have `nonEmpty === false`.
8. Idle ~3.5 s in zone 2; poll `zoneHintText` matches `/Hop gaps with w/`;
   screenshot `qa-artifacts/zone-hint-zone1.png` (same clip) — visual
   evidence of the new verb's text.

### Scenario 2 — statusbar text position after a Zone Hint cycle (AC8)

Same page, immediately after Scenario 1 step 6 (a full show→close cycle has
completed; pre-fix the leaked baseline would already be applied to the
every-frame statusbar redraw):

1. Probe: `getImageData(4, H − 40, 136, 40)`; collect pixels with
   `r < 60 && g < 60 && b < 60 && a > 0` (black "Mode: Normal" glyphs; the
   white position/command text is excluded by the threshold).
2. Assert at least one such pixel exists (text present) and every such pixel
   has canvas-y `≤ H − 16` (mode box bottom). Pre-fix, the leaked
   `"middle"` baseline drops glyph bottoms to ~`H − 11` → fails.
3. Screenshot `qa-artifacts/statusbar-after-cycle.png` clipped to
   `{ x: 0, y: H − 40, width: 200, height: 40 }`.
4. Optional visual note (not asserted): the help hint at top-left shows no
   left-spill smudge in a full-page screenshot; pre-fix its text renders
   centered on the same x as left-aligned, spilling out of its clear rect.

Evidence: 3 screenshots (≤ 6 allowed). Every numbered probe is a Playwright
assertion, not a human eyeball.

## Risks

- **AC7 interpretation:** the issue says "screenshot shows the new zone's
  verb", but the teaching machine shows the entry verb for exactly **one
  animation frame** (next frame hides unless stuck), so a timed screenshot
  cannot reliably catch the swap frame. The spec substitutes a per-frame
  pixel-hash sampler as the machine-checkable equivalent (it proves the
  canvas changed to the new verb _while showing_, which is the actual bug)
  plus a settled screenshot of the room2 verb. If the reviewer demands a
  literal screenshot of the swap frame, that needs a product decision on
  slowing/holding the entry flash — out of scope here.
- The sampler's baseline-equality direction assumes deterministic canvas
  rendering within one page session (same text, same position → identical
  pixels); true in headless chromium. The discriminating direction
  (post-crossing frame differs from baseline) holds regardless, since the
  verb strings differ.
- AC8's geometry assumes the shipped defaults (tileSize 32, scale 1,
  "Mode: Normal" with no descenders). `H` is read from the canvas attribute,
  never hardcoded; the 2 px margin between the alphabetic baseline
  (`H − 18`) and the box bottom (`H − 16`) is tight but deterministic.
- The spawn zone-entry flash draws the Zone Hint once at login, so pre-fix
  the text-state leak is present from the first frames; the QA probes are
  absolute-position based and do not depend on capturing a pre-leak state.
- Blocked-by #4 is already satisfied on this branch (`pixelRect` exists in
  `src/services/draw/utils.ts` and `getZoneHintRect` uses it).
- `drawAfk` leaks `textAlign = "center"` the same way the Zone Hint did;
  explicitly out of scope (Non-goals) — if an AFK box ever overlaps the
  help-hint redraw, that is a separate issue.

STATUS: READY
