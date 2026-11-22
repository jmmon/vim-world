# Two-tier testing plan (headless playtest + Chromium e2e)

Created: 2026-11-20 07:45
Status: BUILT (2026-11-20) — implemented as `playwright.config.ts` +
`e2e/intro.spec.ts` + the `__vimworld` dev hook. Deviations from the plan
learned during the build:
- The hook must be a `useVisibleTask$` (not a body statement or plain
  `useTask$`): Qwik resume never re-runs the component body, and a mount
  `useTask$` without track/cleanup was not serialized to the client.
- Login gate for tests: `isReady && lastAckCheckpoint` — keys sent between
  `isReady` and `INIT.CONFIRM` get dropped on the post-confirm reconcile.
- The world is shared in-memory state: a run consumes the chest key, so a
  **fresh dev server is required per e2e run** (the room3 test fails loudly
  with "stale world" if the chest is already empty). Fixed username
  `e2e-intro-player` keeps the drawn name label pixel-stable.
- `show.devStats=false` now also hides the fps counter and chunk debug
  (they were drawn unconditionally and made goldens non-deterministic).
- `test.e2e` is separate from `test.unit`; vitest excludes `e2e/**` via
  `test.exclude` in `vite.config.ts`.

## Goal

Two complementary test tiers:
- **Inner loop (during dev):** fast headless JSON playtest — already built.
- **Outer gate (before commit):** Chromium browser test — to build.

They test genuinely different layers, so neither is redundant.

## The three layers (bottom two already exist)

| Layer | Runner | Speed | Uniquely catches |
|-------|--------|-------|------------------|
| Unit | `vitest` on pure fns | ms | `stepZoneTeaching`, validators, move/hop rules, parser |
| Playtest | `pnpm playtest` + golden suite (in-proc) | sub-sec | authoritative engine: solvability, entity wiring, action expansion, server validation |
| Browser | Playwright + Chromium | ~5–15s/run | **rendering** (tiles/entities/hint draw), client **prediction + reconciliation**, ws transport, real `keydown`→FSM, the `useZoneTeaching` rAF wiring |

Playtest deliberately bypasses the client (prediction, ack/reconcile, canvas), so
the browser tier is the only thing that sees the client half and the pixels.

## Decision: keep the browser tier THIN (not a JSON mirror)

- Playtest JSONs stay the **logic contract** (inner loop, in `pnpm test.unit`).
- Browser tier = one small fixed spec chosen for what only it can see: each room
  renders, the per-zone hint appears, the door visually opens, entities draw.
  Do NOT re-run the full scenario matrix in the browser — that doubles flaky
  runtime for assertions playtest already owns.
- Add one **dev-only state hook** so the browser asserts values, not pixels:
  ```ts
  // canvas1.tsx, dev only
  if (import.meta.env.DEV) (window as any).__vimworld = state.ctx;
  ```
  Playwright then polls `__vimworld.client.player.pos` / `.zoneHintText` /
  entity state instead of OCR.

## Making the browser tier a reliable gate

- `playwright.config.ts` with
  `webServer: { command: "pnpm dev", url: "http://localhost:5173", reuseExistingServer: true }`.
- **Wait on state, not time**: `expect.poll(() => __vimworld.player.pos).toEqual({x:21,y:8})`.
  Kills flakiness from real 50ms ticks + ws latency.
- **Fresh player per test**: unique username (or clear localStorage) so checkpoints
  don't leak between tests.
- **Visual goldens**: `toHaveScreenshot()` per room; first run writes baselines,
  later runs diff. Pin browser+OS or set a pixel tolerance (canvas AA differs
  across platforms).
- **Hide dev chrome for clean shots**: toggle `show.devStats` off + the Qwik
  "Click-to-Source" badge via the hook before screenshotting.
- **Hint capture**: assert `zoneHintText` after the ~3s idle window (the hint
  shows one frame on zone entry, then again on sit-then-nudge), or screenshot the
  top-center box.

## Where they sit

- `pnpm test.unit` → unit + playtest golden. Fast, every save, CI always.
- `pnpm test.e2e` → Playwright. Opt-in final gate (needs dev server, slower,
  can be flaky). Before commit / CI on a pinned container, NOT the inner loop.

Suggested layout:
```
playwright.config.ts
e2e/intro.spec.ts        # login() helper + one test per room
e2e/screenshots/         # committed goldens
```

## Proven facts (from the feasibility spike, 2026-11-20)

- `pnpm dev` boots the game + `/ws` + tick loop in one process (~2s, `:5173`);
  game at `/canvas1` (301 → `/canvas1/`).
- Playwright + Chromium (`chromium-1248`) already installed; no config/e2e yet.
- Login gate: `<dialog>` `#username` (≥4 chars) → Submit → wait for `INIT.CONFIRM`
  (FSM ignores keys until `isReady`).
- World + hint render on 4 stacked `<canvas>` layers (pixels, not DOM).
- Verified: drove login + `l`/`w`/`yi"`/`pi"` headlessly, player moved, door
  opened, and the "Move with h j k l" hint box rendered after idling.

## Risks

- Browser tier is slower + flakier — keep it thin and state-polled or people skip it.
- Visual goldens are platform-sensitive — generate on the gating OS.
- The `__vimworld` hook must be `DEV`-gated so it never ships to prod.
- No CI observed in-repo (no `.github/`), so the e2e gate is local-only for now.
