# Issue #12 — AFK box no longer overlaps the Zone Hint

## Goal

Move the AFK Overlay Box down so it never intersects the Zone Hint box,
killing the silent-erase bug at the root: the AFK box's fill/clear no longer
wipes Zone Hint pixels while `show.zoneHint` stays set (and closing the Zone
Hint no longer punches a transparent hole through the AFK box). Also fix two
`drawAfk` defects found in the same dig: the "You are AFK!" text must be
centered in its box (it currently uses an absolute `h/2` for y, so it does
not follow the box), and `drawAfk` must restore the `textAlign` it changes —
the same text-state leak class issue #3 fixed for the Zone Hint.

Both boxes co-show routinely: Sit-then-nudge fires after 3 s idle
(`useZoneTeaching.ts`) and the AFK warn fires after 60 s idle
(`src/server/wss/handleAfkDisconnect.ts`), so an AFK player standing in a
zone has both flags set. Non-overlapping placement is also the better UX:
the returning player sees the Verb instead of text stacked on text.

## Non-goals

- No redraw-both rule in the render loop: placement removes the overlap, so
  order-dependent cross-redraw logic is unnecessary.
- No Zone Hint redesign (position, size, color) — excluded by #3.
- No `pixelRect` rounding of the AFK rect: all edges are integers at integer
  `tileSize` (32), same as today.
- No fix for negative AFK width when `viewport.width < 13·tileSize`
  (pre-existing, separate concern).
- No change to the server AFK ladder timings (`handleAfkDisconnect.ts`).
- No AFK↔help-box overlap handling at tiny line counts (see Risks).

## Contracts

### `src/services/draw/overlay.ts` — `getAfkRect`

Export it (mirrors `getZoneHintRect`, which the spec file already imports)
and change only the y:

```ts
/** @returns [x, y, width, height] array */
export function getAfkRect(viewport: Viewport, { tileSize }: MapConfig) {
    return [
        tileSize * 6.5,
        tileSize * 2.5, // must stay below the Zone Hint bottom edge (see invariant)
        viewport.width - tileSize * 13,
        tileSize * 5,
    ] as const;
}
```

**Invariant (comment this in the source):** the AFK rect top
(`2.5·tileSize`) must stay at or below the Zone Hint rect bottom. The hint
bottom is `pixelRect`'s ceil of `0.5·tileSize + 1.6·tileSize`, i.e.
`≤ 2.1·tileSize + 1 px`; the gap is `0.4·tileSize − 1 px` (12 px at
tileSize 32, lower bound 11.8), positive for every real `tileSize` and
scaling with tileSize, so the two rects are disjoint for all viewport
widths and scales. This comment is a contract requirement the review
station gates — unit tests cannot assert comments.

`clearAfkRect` / `closeAfk` are unchanged: they call `getAfkRect`, so the
clear follows the new position automatically, including the old-rect clear
on scale change via `generateOldDimensions`.

### `src/services/draw/overlay.ts` — `drawAfk`

- Text y: `dimensions[3] / 2` → `dimensions[1] + dimensions[3] / 2`, so the
  text centers inside the box wherever the box sits.
- Save `ctx.textAlign` before setting `"center"` and restore it after
  `fillText` — the exact save/restore pattern `drawZoneHint` uses
  (overlay.ts:496, 503). `drawAfk` does not change `textBaseline`; leave it.
  Without the restore, a shown AFK box center-aligns later Help / Help Hint
  text, which never set `textAlign` themselves.
- Fill color, font, text content, and clear-first behavior stay as-is.

### `src/hooks/useRenderLoop.ts` — unchanged

The `wasAfkShowing` / `zoneHintNeedsRedraw` edge logic stays as-is: with
disjoint rects, neither box's draw/close touches the other's pixels.

## Acceptance criteria

1. `getAfkRect` returns `y = 2.5·tileSize` with x, width, height unchanged;
   at tileSize 32: `[208, 80, viewport.width − 416, 160]`.
2. The AFK rect and the Zone Hint rect are disjoint — `afk[1] ≥
   hint.top + hint.h` — for representative viewport widths (20, 40, 100
   tiles) at tileSize 32 and scales 1 and 1.25.
3. After `drawAfk(state)` on a recording ctx stub, `ctx.textAlign` equals
   the value it had before the call.
4. `drawAfk` calls `fillText("You are AFK!", x + w/2, y + h/2)` with the
   box's current coordinates (tileSize 32: `208 + w/2`, `160`).
5. `drawAfk` (via `closeAfk`) clears the rect at the new position:
   `clearRect` receives the `getAfkRect` values.

## Test plan

Unit only, in the existing `src/services/draw/overlay.spec.ts` (prior art:
the `getZoneHintRect` describe and the `drawZoneHint text-state restore`
describe — recording ctx stub, `as unknown as` casts, no DOM). New
describes:

- `getAfkRect`: y equals `2.5·tileSize`; disjointness against
  `getZoneHintRect` across widths {20, 40, 100}·tileSize and scales
  {1, 1.25} (AC1–2).
- `drawAfk`: textAlign restored (AC3); `fillText` center coordinates
  (AC4); `clearRect` covers the new rect (AC5). The stub must set
  `config.scale === config.lastScale` so `hasScaleChanged` stays false and
  `closeAfk` clears exactly one rect (prior-art `hintState` already does).

No e2e: the AFK message requires 60 s server-side idle (`afkMs`), too slow
and flaky for the suite; the geometry invariant is fully covered by the
pure disjointness test.

## QA plan

Factory QA smoke only — the 60 s AFK timer is deliberately not
browser-tested:

1. Boot `pnpm dev --port 5199 --strictPort`, open `/canvas1`, log in as
   `qa-afk-move`, wait for `__vimworld.client.isReady`.
   Expected: map renders, statusbar visible, no overlay artifacts.
2. Walk right (`l`) into a zone so the Zone Hint shows; screenshot.
   Expected: Zone Hint box at top-center; pixel probe shows alpha > 0 inside
   the Zone Hint rect and alpha == 0 in the band between the hint bottom and
   `y = 2.5·tileSize` (the gap where the AFK box used to start).

## Risks

- Tiny viewports: the move lowers the AFK↔help-box overlap threshold from
  `viewport.height < 14·tileSize` to `< 16·tileSize`. At `:set lines` near
  the minimum the help box top (`viewport.height − 8.5·tileSize`) can rise
  into the AFK box — the same erase class, pre-existing at tiny sizes, out of
  scope; a future overlay layering pass should handle it.
- The alphabetic text baseline puts the AFK text slightly above the box's
  geometric center (baseline sits at center). Cosmetic, matches prior
  intent; not switching to `middle` baseline.
- `viewport.width < 13·tileSize` yields a negative AFK width: pre-existing,
  unchanged by the move.
- fps / dev-stats boxes are right-anchored with scale-scaled widths; at
  menu zoom `scale > ~1.31` the dev-stats box (width `158.4·scale` px)
  overlaps the AFK box's right margin (208 px) and repaints every frame —
  same silent-erase class. Pre-existing (the old AFK rect overlapped more),
  dev-only toggle, out of scope.

STATUS: READY
