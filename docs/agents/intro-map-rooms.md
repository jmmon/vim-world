# Intro map → rooms (per-room build order)

The single intro map is broken into **discrete rooms**, each teaching exactly one
Vim verb. Build **one room at a time**; each room is self-contained and reachable
start-to-end on its own. Later rooms connect to the previous room's exit gap.

This is the *what* and *in what order*. The underlying ASCII-data format, parser,
link model, and zone/teaching mechanics live in `docs/agents/map-ascii-plan.md` —
read that for *how* the map is built.

Build order: `hjkl` → `w`/`b` → `yi"` → `pi"` → exit.

## Build checklist

- [x] **Room 1 — `hjkl`** (movement). Built, gate green.
- [x] **Room 2 — `w`/`b`** (hop over gaps). Built: 3 water channels, forced `w`
  hops, verified by playtest trace. Gate green.
- [x] **Room 3 — `yi"`** (yank the key from the chest). Built, verified by playtest.
- [x] **Room 4 — `pi"`** (paste the key into the keyhole, unlock the door). Built,
  verified by playtest (door opens).
- [x] **Room 5 — exit** (no new verb; the door + exit gap). Built: grass landing
  beyond the open door, verified by playtest (player walks out).
- [ ] **Extra — gale room** (optional, after the core five). A `gale` effect tile
  pushes the player; teaches that ambient tiles move you. See "Extras" below.
- [ ] **Extra — double-key room** (optional). Two keys, two keyholes, one door;
  teaches that a door can need more than one key. See "Extras" below.

Each room: build the map slice → run the playtest scenario → re-derive `expect`
from real engine output → full gate green before the next room.

---

## Layout model

Rooms are laid out **left-to-right**, each a **16×16 cliff box** at world y 0–15:

| Room | Verb | World x-range | Grid width (when built) |
|------|------|---------------|-------------------------|
| 1 | `hjkl` | 0–15  | 16 |
| 2 | `w`/`b` | 16–31 | 32 |
| 3 | `yi"` | 32–47 | 48 |
| 4 | `pi"` | 48–63 | 64 |
| 5 | exit | 64+   | grows when built |

`INTRO_MAP` in `src/server/map.ts` is the single source of truth: compact ASCII
`grid` (cell `(r,c)` → world `origin+[c,r]`, `origin=[0,0]`), `defs` (entities at
fixed world coords), `zones` (`xRange` inclusive + `verb` + optional `solved`).
Uncovered cells fall through to the procedural forest base.

**The grid grows horizontally as rooms are built.** Room 1 uses a 16-wide grid;
building Room 2 extends it to 32 wide (Room 2 occupies cols 16–31); and so on.
`defs` always use world coords, so entity positions don't move when the grid grows.

### Shared build rules (every room)

- **One verb per room.** The room's teaching zone carries a single `verb`; the
  contextual hint panel shows it on zone entry (incl. spawn) and after ~3s stuck,
  auto-dismissing on `isSolved` (`src/hooks/useZoneTeaching.ts`). Room 1's panel is
  already wired — no extra work.
- **Cliff box.** Forced `#` cliff on all four walls except the entry/exit gaps.
  Interior floor is left to the procedural forest base.
- **Start-to-end path.** Force a walkable path from entry (or spawn) to exit so the
  room is solvable on its own. Outside the required path, the floor stays procedural.
- **Exit gap.** A one-tile opening in a wall, leading into the next room's entry
  gap (built in a later step). The tile just past the gap is forced grass so exiting
  is smooth.
- **Spawn** = the `SPAWN` def (`defs["<x>,<y>"] = { type: "SPAWN", dir }`), which is
  also the respawn checkpoint (`checkpointService`). Only Room 1 has a spawn; later
  rooms are entered through their entry gap.

### Tile cheat-sheet

`.` grass (walkable), `,` dirt (walkable), `~` water (solid + **hoppable**), `#`
cliff (solid). Space = leave to procedural base. `w`/`b` are two-tile horizontal
hops (east/west) that clear one water tile; they cannot clear a cliff.

---

## Room 1 — `hjkl` (movement)

16×16 cliff box. Movement only: spawn + open room + a walk-through exit gap on the
right wall. No chest/keyhole/door. The hint popup ("Move with h j k l") shows on
spawn and when stuck.

- **Walls**: `#` on all four sides; exit gap at `(15,8)` (right wall).
- **Floor**: procedural inside; forced grass path along `y=8` from spawn to exit.
- **Beyond gap**: `(16,8)` forced grass (Room 2 entry).
- **Spawn**: `(2,8)`, facing `E`.
- **Zone**: `{ id: "room1-hjkl", xRange: [0,15], verb: "Move with h j k l" }`
  (no `solved` — the zone transition handles leaving).

Forced tiles:

```
defs: {
    "2,8": { id: "SPAWN-1", type: "SPAWN", dir: "E" },
},
// grid (16×16, origin [0,0]); only the y=8 path + walls are forced:
//   y=0  and y=15 : full '#'
//   x=0 (every row) : '#'
//   x=15 : '#' except y=8 (the gap, forced grass '.')
//   y=8, x=2..14 : '.' grass (spawn-to-exit path)
```

Representative grid (row = world y, col = world x, `.` = forced grass, space =
procedural, `#` = cliff):

```
################
#             #
#             #
#             #
#             #
#             #
#             #
#             #
#  ........... .
#             #
#             #
#             #
#             #
#             #
#             #
################
```

Row `y=8`: `#  ........... .` — spawn at x=2, corridor x=3..14, gap/grass at x=15.

Playtest: re-derive affected `expect` blocks after building (see end of this doc).

---

## Room 2 — `w`/`b` (hop) — **BUILT**

16×16 cliff box (world x 16–31). Entry gap at left wall `(16,8)` (feeds Room 1's
exit gap at `(15,8)`). Exit gap on the right wall `(31,8)`. **Three vertical water
channels** at world x 20, 24, 28 span the full interior height (y 1–14), so they
cannot be walked around — each must be hopped east with `w`. Interior floor is
forced grass (deterministic, no procedural surprises on the teaching path).

The provisional descending-staircase draft (alternating `w`/`b`) was dropped:
forcing a west hop cleanly needs contrived geometry, and the verb's primary use
in a left-to-right room is the east hop. `b` remains available for backtracking
but is not required. The playtest trace is the proof.

Forced tiles (world coords; `~` water, `.` grass, `#` cliff):

```
defs: { "2,8": { id: "SPAWN-1", type: "SPAWN", dir: "E" } }   // unchanged (Room 1)
zones: { id: "room2-hop", xRange: [16, 31], verb: "Hop gaps with w" }
// grid cols 16–31; water at x=20,24,28 for every interior row y1..14;
// left wall x16 and right wall x31 are '#' except the y=8 entry/exit gaps.
```

Playtest `room2-hop.json` walks from spawn to the first gap and hops across all
three. Real engine trace (the forcing proof):

```
(2,8) --17l--> (19,8)   # stops at 19: water at 20 blocks walking
(19,8) --w-->  (21,8)   # hops over water at 20
(21,8) --2l--> (23,8)   # stops at 23: water at 24 blocks walking
(23,8) --w-->  (25,8)   # hops over water at 24
(25,8) --2l--> (27,8)   # stops at 27: water at 28 blocks walking
(27,8) --w-->  (29,8)   # hops over water at 28
(29,8) --2l--> (31,8)   # exit gap
```

Each `l` walk halts exactly one tile before a channel (water is solid), and each
`w` clears it — so the hop is genuinely forced, not optional.

---

## Room 3 — `yi"` (pick up key) — **BUILT**

16×16 cliff box (world x 32–47). Entry gap at left wall `(32,8)` (feeds Room 2's
exit `(31,8)`), exit gap at right wall `(47,8)`. **One chest holding the key.**
Teaches `yi"` (yank + inside-textobject + `"` register → pick up the item inside
the chest). No `di"` (drop) — not implemented; deferred.

- **Chest** `CHEST-KEY` at world `(40,7)` — **north of the y=8 path** so it does
  not block the corridor (a chest stays solid after its item is yanked). The
  player walks to `(40,8)`, faces it with `k` (a blocked move still turns facing),
  then `yi"`. `collision.solid`, `container { capacity:1, itemIds:["789"],
  behavior:"PERSIST" }`, `interactable { selectors:['"'], actions:[{PICK_UP}] }`.
  `"789"` is the key's legacy prevId; `objects.ts` resolves it to the generated
  key id (link group `a`).
- **Path**: forced grass y=8 from `(32,8)` → `(47,8)`.
- **Zone**: `{ id: "room3-yank", xRange:[32,47], verb: 'Take the key with yi"',
  solved: { takeKey: "a" } }` — the hint auto-dismisses once the player carries
  the key (`keyIdByLink["a"]`).

Playtest `room3-yank.json` traverses Rooms 1→2→3 (hops the water), faces the
chest, and yanks. Trace proof: the `k` returns COLLISION (blocked by the chest)
but turns facing N; `yi"` then moves `KEY-8BB6yFGjn9V` into the player's
inventory.

**Key flow:** the key picked up here is carried into Room 4 (see Key flow below).

---

## Room 4 — `pi"` (place key, open door) — **BUILT**

16×16 cliff box (world x 48–63). Entry gap at left wall `(48,8)` (feeds Room 3's
exit `(47,8)`), exit via a **locked door** in the right wall that opens onto Room 5.
Teaches `pi"` (paste + inside-textobject + `"` register → place the key in the
keyhole). One water hop between entry and keyhole (final hop practice).

- **Hop**: one full-height water channel at world x52 (y1–14) forces a single `w`
  hop from `(51,8)` to `(53,8)`.
- **Keyhole** `KEYHOLE-1` at `(62,7)` — north of the path beside the door. The
  player faces it with `k` from `(62,8)` and pastes with `pi"`. `link:"a"`,
  `collision.solid`, `container{capacity:1, itemIds:[], behavior:"PERSIST"}`,
  `interactable{selectors:['"'], actions:[{PICK_UP}]}`.
- **Door** `DOOR-1` at `(63,8)` in the right wall: `link:"a"`,
  `state:{kind:"DOOR",open:false,locked:true}`, `collision.solid`. The grid tile
  under it is forced grass, so when the door opens (collision released) the tile
  becomes the walkable exit.
- **Path**: forced grass entry → hop → `(62,8)` → door.
- **Zone**: `{ id: "room4-paste", xRange:[48,63], verb: 'Place the key with pi"',
  solved: { openDoor: "DOOR-1" } }`.

The door opens when the Room 3 key is pasted into the keyhole: the parser wires
`KEYHOLE-1.lock.doorId = "DOOR-1"` (and `DOOR-1.lock.requiredKeyholeIds`) via link
group `a`; `maybeUnlockKeyhole` consumes the key and releases the door's collision.

Playtest `room4-paste.json` is the full end-to-end arc: spawn → hop Room 2 → yank
the key in Room 3 → hop Room 4 → `pi"` the keyhole. Trace proof: after `pi"` the
player's inventory is empty (key consumed) and `DOOR-1` reads
`state.open:true, state.locked:false, collision.solid:false`.

---

## Room 5 — exit (end of intro) — **BUILT**

Not a teaching room. The grid extends 8 columns (world x 64–71) east of Room 4's
door as a forced-grass landing, bounded top/bottom by cliff and **open on the
right edge** (no wall) so it "opens onto the wider world" (procedural base takes
over past x71). No verb, no zone, no win mechanic (none exists in the engine).

The only thing to prove is that the opened door is walkable and leads out:
`room5-exit.json` runs the whole arc then walks `l` through `(63,8)` (the open
door tile) to `(66,8)` in the landing.

---

## Extras (optional, after the core five)

These extend the intro beyond one-verb-per-room. Status after investigating the
engine:

### Gale room — **BLOCKED: no runtime mechanic**

A `gale` tile effect exists only as data: the `TileEffect` type (`src/server/map.ts`)
and the parser overlay (`getHandAuthoredEffectAt`). **Nothing in the simulation
reads it** — no code pushes a player standing on a gale tile (grep for `effect`/
`gale` in `src/simulation/` finds nothing). So a gale room would teach nothing.
Building it requires a new simulation feature first: on each tick, a player on a
gale tile is pushed `force` tiles in `dir` (server-authoritative + client
prediction mirror). That is a gameplay feature, not a map change — deferred until
that mechanic is implemented.

### Double-key room — **FEASIBLE (map + data only)**

The lock model already supports it: `maybeUnlockKeyhole` opens a door only when
every id in `door.lock.requiredKeyholeIds` is used, and `keyIdByLink` is keyed by
each KEY item's `link`. To build it: add a second KEY item with `link: "b"` to
`ITEMS` in `src/server/objects.ts`, then author two chests (one per key), two
keyholes (`link:"a"`, `link:"b"`) both wired to one door, and a zone with a
`solved` that checks both keys carried. No simulation change needed.

Caveat: adding a second KEY item changes the global `ITEMS` list (and thus
`ITEMS_WITH_IDS` / generated ids), so the seed-derived key ids in the existing
golden scenarios could shift — re-derive them after. Worth doing only if the
intro should teach multi-key doors; otherwise it is scope beyond the core arc.

---

## Key flow (Rooms 3 → 4)

One key, link group `a`. Picked up in Room 3 (`yi"` → `player.itemIds`), carried
through into Room 4, placed with `pi"` on the keyhole to unlock `DOOR-1`. The
teaching resolver `{ takeKey: "a" }` targets the right key via `keyIdByLink`, so the
same key works across rooms. No resolver change needed — only the map's `defs` and
`zones`.

---

## Playtest update workflow (after any map change)

Re-derive affected `expect` blocks from **real engine output**, don't hand-type:

```
pnpm playtest src/server/playtest/scenarios/<file>.json --verbose
```

read the actual final `pos`/`dir`/`items`/entity states, then edit that scenario's
`expect` JSON to match. Pure-FSM scenarios (`command-line`) have no map dependency
and never change. See `docs/agents/playtest-spec.md`.

## Current status

- Room 1 (`hjkl`): **DONE** — built in `src/server/map.ts` (16×16 cliff box, spawn
  `(2,8)` E, forced grass path y=8, exit gap `(15,8)`, single `room1-hjkl` zone).
  Playtest scenarios re-derived; the three map-coupled unit specs
  (`entities.spec.ts`, `useZoneTeaching.spec.ts`, `move.spec.ts`) were decoupled
  from the live map with self-contained fixtures so future rooms won't break them.
  Full gate green.
- Room 2 (`w`/`b`): **DONE** — built in `src/server/map.ts` (grid extended to 32
  wide; Room 2 = world x16–31, three full-height water channels at x20/24/28,
  forced grass interior, entry gap `(16,8)`, exit gap `(31,8)`, `room2-hop` zone).
  Golden scenario `room2-hop.json` proves the `w` forcing via the engine trace.
  Full gate green.
- Room 3 (`yi"`): **DONE** — chest `CHEST-KEY` at `(40,7)`, `room3-yank` zone with
  `takeKey:"a"` resolver. `room3-yank.json` proves the yank.
- Room 4 (`pi"`): **DONE** — keyhole `KEYHOLE-1` `(62,7)` + door `DOOR-1` `(63,8)`
  linked by group `a`, one water hop at x52, `room4-paste` zone with `openDoor`.
  `room4-paste.json` proves the full arc + door unlock.
- Room 5 (exit): **DONE** — grass landing x64–71 beyond the open door, open right
  edge. `room5-exit.json` proves walking out through the opened door.
- Extras: gale room **BLOCKED** (no runtime gale mechanic); double-key room
  **FEASIBLE** (map + a second KEY item) but optional scope. See "Extras".
- Full gate green: 110 unit tests (5 golden playtest scenarios), lint, typecheck,
  build.
