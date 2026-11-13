# Phase 0 — Implementation Plan

> The smallest complete slice that tells us if the game is fun. One hand-made
> map, `hjkl` + `w/b` + pick-up-a-key → place-on-door, and ghosts. (No `10j`/gale
> — that's Phase 0.5.)
>
> **Goal of Phase 0:** (1) prove the core loop is fun, (2) de-risk the two
> technical unknowns — **hand-authored maps** and **FSM verb support**.

---

## 0. Guardrails

- Keep **snap** movement (tile-to-tile). No glide. Glide is later, tested vs
  multiplayer.
- **Single-key-hold:** player carries at most one key (`carryingObjId` is already
  single-slot). This is what makes the two-key door a puzzle.
- Follow `docs/design/DESIGN.md` — this plan serves it.
- Full gate before finishing: `pnpm test.unit && pnpm lint && pnpm build.types && pnpm build`.
- No weakening tests. Format only files you touch.

---

## 1. De-risk #1: hand-authored maps (probe first)

The current map system is **purely procedural** (`map.ts` → `generateChunk` from
value-noise/FBM by chunk seed). There is no concept of a curated map. This is the
biggest unknown, so it gets a probe before we commit to 10 maps.

**Probe (1 day):** add a way to author a small map by hand, layered *over* the
procedural system so the rest of the engine is unchanged.

- Design a minimal **map format** — e.g. a 2D array of `TileType` (or a small
  JSON/TXT grid) for a fixed small size (e.g. the intro map, ~40×25 tiles).
- Add a `Zone`/`MapConfig` variant (e.g. `mode: "hand-authored"`) that serves
  that grid through the *same* chunk/tile accessor (`getTileByWorldCoords`,
  `getChunkByWorldCoords`) the rest of the engine already uses.
- Verify: it renders, collision works, `isWalkable`/`isWithinBounds` behave.

**Decision point:** if the probe works in ~1 day, hand-authored maps are viable —
proceed. If it's messy, fall back to *curating* procedural maps (tune noise seed
+ bands + place objects by hand) and note why.

**Why probe-first:** committing to 10 hand-tuned maps on unproven infrastructure
is the single way Phase 0 blows up. One small probe de-risks all ten.

---

## 2. De-risk #2: FSM verb audit + gaps

Audit `src/fsm/` + `src/components/inventory/utils/FSM.ts` +
`src/simulation/shared/actions/` for exactly what Phase 0 needs. Known to exist:
counts (`10j`), operators + `i`/`a` qualifiers, `f`/`F`. Likely gaps:

- **`yi"` pick up from inside a chest** → already sketched in `interact.ts`
  (`applyYankCommand`, `pickUpItem`). Verify it runs end-to-end.
- **`pi"` place key on a door** → `placeItem` is a **TODO**. Likely the main new
  verb work. Plan it in §5.
- **`w`/`b` hop** over one tile → verify movement validator allows it.
- **`10j` expansion across ticks** → already acked per-partial (`loop.ts`).
  Verify on the new hand-authored map.

**Decision point:** if a verb is missing and cheap, add it. If it's a big gap,
trim Phase 0 (e.g. start with just pick-up, add place next).

---

## 3. Movement & collision sanity

Assume mostly-working (acknowledged as proven-ish), but verify on the new map:

- Snap movement, ≤3 steps/tick, `10j` → `3j`×3 + `1j`.
- `w`/`b` hop over exactly one tile.
- Collision with WATER/CLIFF solid; DIRT/GRASS walkable.
- Bounds at map edge.

If movement *feels* bad here, Phase 0 isn't done — that's the biggest risk to
"is it fun," and it's why we build the slice before the other maps.

---

## 4. Entities: key + keyhole + door (the new content)

Existing patterns exist (`WorldEntity`, `interactable`, `container`,
`collision`, `OBJECT_COLOR_MAP` in `services/draw/objects.ts`). The keyhole
reuses the chest's paste path. Two things the plan's §1 probe did NOT cover had
to be resolved before building:

### 4a. Authored entity positions (Gap 1 fix)

`objects.ts` currently **randomizes** every entity's position from `zone.seed`
(`randomizeEntityPositions`). A designed intro map needs **known** positions, so
entities can't be random. Fix: the hand-authored zone carries an `entities`
overlay — `{x, y, type, ...}` — and `buildEntities` places hand-authored
entities at those fixed positions (procedural zones keep random placement). The
door/keyhole/key are authored, not scattered.

### 4b. The door state must sync (Gate risk)

The client **self-gates its own movement on entity collision**
(`applyMoveAction` → `sharedValidators.move` → `isWalkable` reads
`state.world.entities`), and INTERACT is sent to the server. The server sends
**only player/ghost state** live (`message.ack`, `message.playerMove`); the
client loads entities once from `/api/map` and never updates them. So a door that
opens only on the server won't let the player walk through (client still sees it
solid), and one that opens only on the client gets overridden by the server.
**The door state must be consistent on both sides.** Fix: a **narrow** sync —
broadcast only door/keyhole state (extendable to other entities later). Normal
play sidesteps the prediction edge case: approach the door (it's solid, you
stop), `pi"` (it opens, sync lands), then walk through on a fresh prediction
against the now-open door.

### 4c. The door/keyhole entities (data model)

- **Key** — a pick-up item (`kind: "KEY"`). `yi"` from a chest (`i` qualifier).
  Single-slot carry.
- **Keyhole** — a wall slot **linked to one door**. Chest-like: same
  `interactable.selectors` + paste path as a chest. Face it, `pi"`.
  ```ts
  {
    id: "KEYHOLE-<base58>",
    type: "KEYHOLE",
    pos: { x, y },                       // authored (4a)
    collision: { solid: true },          // slot in a wall
    container: { capacity: 1, itemIds: [], behavior: "PERSIST" },  // pi" paste path
    interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
    lock: { doorId: "DOOR-<base58>", used: false },  // links to its door
  }
  ```
  Validation reuses `findObjectInRangeByKey` (finds it in facing range). On
  `pi"`: push the key into `container` (reuses `placeItem`), then a new hook
  `maybeUnlockKeyhole` checks the key, consumes it, flips `lock.used = true`, and
  if all `requiredKeyholeIds` are used → opens the linked door.
- **Door** — a `DOOR` entity (the type already exists) with `collision.solid`
  on a walkable tile. Flips locked → open when its linked keyhole(s) are all
  unlocked; `collision.solid = false` on open. Sound + animation on open; the
  path is revealed. Key **consumed** on use (commitment).
- **Linking field (`lock.doorId` + `requiredKeyholeIds`) is added in Phase 0** so
  the same code serves the deferred 2-key door (multiple keyholes around one
  door; player doesn't know which slot links to which door).

Phase 0 = one key, one keyhole, one door. `DOOR`/`KEYHOLE` are added to
`OBJECT_COLOR_MAP` so they render; on open, render lighter / skip the bar.

---

## 5. The intro map (hand-authored) — zone beat sheet

One map, **4 zones**, one idea each. See `DESIGN.md §4.5`. Concretely:

1. `hjkl` — open room, reach a goal.
2. `w`/`b` — a 1-tile gap.
3. `yi"` — chest with the key.
4. `pi"` — keyhole → door. Place the key, key consumed, door opens with
   sound + animation, path revealed → next zone.

### Teaching (decided: panel + static guide, no animated NPC)

§4.1 "teach by forcing / wait-then-nudge" is a **design** principle; the medium
is a **contextual hint panel**, not a text box that blocks play. The existing
help system is reused, not rebuilt:

- **Persistent help** (`:h` / `g?` / `:help`) → toggles the bottom panel
  (`services/draw/overlay.ts:drawHelp`), listing `hjkl`, `w`/`b`, and the help
  hotkey. Reference for skilled players — **no gating** (level system deferred).
- **Per-zone contextual teaching (new):** when the player crosses a zone's
  position-based trigger region, a contextual hint panel shows that zone's verb
  (`w` = jump right / `yi"` = take item inside / `pi"` = place key), shown on
  zone entry plus a **sit-then-nudge** fallback (after ~3s stuck, show the
  current zone's verb), then fades.
- **Static guide figure** at each zone boundary — a sign or standing NPC as a
  visual anchor + presence. **No animation** ("running around doing motions" is
  scope + unsure it looks good; defer animated NPC to Phase 0.5+).

### Deferred (Phase 0.5+)

- Level/progress gating of the help panel content.
- Count-gating (e.g. limit to 3 counts early; unlock `10l` with the gale).
- Level/progress UI indicator.
- Animated NPC guides.
> The gale (pushback tiles, `3l`/`10l`) is **deferred to Phase 0.5** — it's new
> movement-validator work. The "teach by forcing discovery" idea stays; it just
> lands on the gale later.

---

## 6. Ghosts (mostly done)

Ghosts already render (acknowledged). Phase 0 needs:

- Render other players **semi-transparent** (a style change, likely small).
- Reuse the **same** snap movement path — no separate ghost system.
- Position-only sync is fine (low fidelity).

**Resolved:** transparency is a small style change (a style change, likely small),
confirmed small enough for Phase 0.

---

## 7. Order of work

1. **Probe hand-authored maps** (§1) — **DONE.** 9 tests pass; hand-authored
   zones (procedural base + forced-tile overlay + ambient effects) are served
   through the same chunk/tile accessors as procedural maps.
2. **FSM verb audit** (§2) — **DONE.** `hjkl`, `w`/`b` hop, counts, `yi"`,
   `ya"`, `pi"` all already work. `da`/`ca` and `f`/`F` don't (neither is needed
   for Phase 0). The only new work is the **door/keyhole** (§4).
3. **Authored entities overlay** (§4a) — hand-authored entities placed at fixed
   positions instead of random.
4. **Movement sanity** (§3) — on the new map.
5. **Key + keyhole + door entities** (§4c) — the new content + `OBJECT_COLOR_MAP`.
6. **`pi"` unlock hook** (§4c) — `maybeUnlockKeyhole`: consume key → mark used →
   open linked door.
7. **Narrow door-state sync** (§4b) — broadcast door/keyhole state; client merges
   + redraws. Extendable to other entities later.
8. **Intro map + zones** (§5) — hand-author the beat sheet.
9. **Teaching / hints** (§5) — per-zone contextual panel + sit-then-nudge +
   static guide; reuse existing help system.
10. **Ghosts** (§6) — transparency (small, confirmed).
11. **Gate:** full test/lint/build/typecheck/production build.

---

## 8. Definition of done

A player can: load the intro map → move with `hjkl` → hop a gap with `w` → pick
up a key with `yi"` → place the key on the keyhole with `pi"` → watch the linked
door open with sound + animation, then walk through. And, if others are online,
see their ghosts. **Then** we know Phase 0 is fun — and we build the rest.
