# Phase 0 intro map → ASCII-data format

Replace the hand-written `buildIntroGrid()` overlay + `INTRO_ENTITIES` array with a
single **ASCII-data source** (`INTRO_MAP`) plus a small **parser** that emits the
same `zone` shape the engine already expects. Design data in one place; no runtime
behavior change.

Status: **implemented** — every section below is done and the full gate is green
(`pnpm test.unit && pnpm lint && pnpm build.types && pnpm build`: 86/86 tests).

---

## 1. The ASCII source (`INTRO_MAP`)

One object = the whole intro map (128×128, 4×4 chunks). `origin` = world coords of
the top-left cell so the grid is position-agnostic.

```ts
export const INTRO_MAP = {
  origin: [0, 0],
  seed: 12345678,                 // procedural base terrain seed
  baseRuleset: "forest-v1",       // what procedural terrain to seed the base from
  grid: [
    "........................",   // y = 0
    // ... rows of mostly space (leave to procedural base) ...
    "  .......................",   // y = 8   grass corridor
    "  .......................",   // y = 9   grass niches up to chest/keyhole
    "  ..~~...............",      // y = 10  gap ~, corridor
    // ...
  ],
  // NOTE: the grid is terrain only. Entity letters used to sit on their tiles
  // as decoration, but they are decorative — entities are placed at fixed world
  // coords by `defs` below, which is what the engine reads. Keep the grid as
  // tiles (`.` grass, `~` water, `,` dirt, `#` cliff); don't align entity
  // letters to them.
  defs: {
    "12,8": { id: "CHEST-KEY", type: "CHEST", key: "a",
              container: { capacity: 1, behavior: "PERSIST" },
              interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] } },
    "20,8": { id: "KEYHOLE-1", type: "KEYHOLE", link: "a",
              container: { capacity: 1, behavior: "PERSIST" },
              interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] } },
    "26,10": { id: "DOOR-1", type: "DOOR", link: "a",
               state: { kind: "DOOR", open: false, locked: true },
               collision: { solid: true } },
    "4,10": { id: "SPAWN-1", type: "SPAWN" },
  },
  zones: [
    { id: "room1",   xRange: [0, 6],  verb: "Move with h j k l" },
    { id: "gap",     xRange: [7, 7],  verb: "Hop across with w" },
    { id: "chest",   xRange: [8, 19], verb: 'Take the key with yi"', solved: { takeKey: "a" } },
    { id: "keyhole", xRange: [20,27], verb: 'Place the key with pi"', solved: { openDoor: "DOOR-1" } },
  ],
};
```

### Coordinate model (read this)

The ASCII source is **compact** (one grid row per ASCII line) and positioned by
`origin` — the world coords of the top-left cell. The parser keeps the grid compact
(it does **not** expand to a full 128×128 grid) and stores `origin` on the parsed
`zone`; `getHandAuthoredTileAt` applies the offset at read time:

- ASCII cell `(row r, col c)` → world `(origin.x + c, origin.y + r)`.
- To read a world `(wx, wy)`: grid coords are `(wx - origin.x, wy - origin.y)`. If
  that is **inside** the grid, the placed tile wins; if it is **outside**, the cell
  falls through to the procedural base.
- A cell outside the grid is **not** clamped to the nearest edge — that used to bleed
  a border row/col across the whole map (the "cliffs on y≥7" bug), so out-of-range is
  a fall-through, never an override.
- `defs` keys are **world coords directly** (`"12,8"`), independent of the ASCII.

For this map `origin` is chosen so the ASCII window lines up with the designed entities
(e.g. `origin = [0, 0]` puts ASCII row 0 at world y=0). Uncovered rows/cols fall
through to the seed-dependent procedural base.
```
. GRASS    ~ WATER    , DIRT    # CLIFF
```
Space = **leave to procedural base** — unplaced cells fall through to the
seed-dependent forest.

### Entity characters
```
S SPAWN    C CHEST    O KEYHOLE    D DOOR    T TREE    B BOX    N STONE
```
---

## 2. Link groups (chest ↔ keyhole ↔ door)

No separate `links` object. Each entity carries a link id; the **door is the anchor**
of every group.

- KEYHOLE `link: "a"`  → door in group `a`
- DOOR `link: "a"`     → anchor of group `a`
- CHEST `key: "a"`     → holds the key for group `a`

**Parser wiring (two passes over `defs`):**
1. Group every entity by its `link` id. Group `a` → `[KEYHOLE-1, DOOR-1]`.
2. For each KEYHOLE, find the DOOR in its group → set `KEYHOLE.lock.doorId = DOOR-1`
   and push the keyhole into `DOOR.lock.requiredKeyholeIds`.

The chest does **not** carry a `key:` here — it holds the item's legacy prevId
(`"789"`) in `container.itemIds`, which `objects.ts`'s `resolveContainer` maps to the
concrete generated key id (`KEY-...`) at build time. The KEY item's group identity
lives on the item itself (`link: "a"` in `objects.ts`'s `ITEMS`), not in the map — see
§5. So the parser wires KEYHOLE↔DOOR only; the chest↔key link is resolved by
`objects.ts`, keeping `zone` synchronously buildable in `map.ts`.

The parser emits the exact `zone` shape the engine expects
(`{ seed, ruleset: "hand-authored", baseRuleset, grid, entities }`) — so
`getHandAuthoredTileAt`, `/api/map`, and all existing tests are unchanged. `seed` and
`baseRuleset` come straight from `INTRO_MAP` (both editable in the config).

---

## 3. Declarative zone completion (`solved`)

Teaching verbs + position ranges move into `INTRO_MAP.zones` (one place). The
`isSolved` logic stays in code — it's the only non-declarative half, because it has
to query live game state.

### Spec shape
```ts
interface ZoneTeach {
  id: string;
  xRange: [number, number];
  verb: string;
  // omitted  → default: "leave" (derived from xRange, no magic number)
  // "takeKey" → { takeKey: "a" }
  // "openDoor"→ { openDoor: "DOOR-1" }
  solved?: "leave" | { takeKey: string } | { openDoor: string };
}
```

### Resolver (~15 lines, in `useZoneTeaching.ts`)
```ts
const RESOLVERS = {
  leave:    (s) => s.player.pos.x > s.zone.xRange[1],
  takeKey:  (s) => (s.player.itemIds ?? []).some(isKeyId),
  openDoor: (s) => {
    const d = s.world.entities.get(s.zone.solved.openDoor);
    return !!d && !d.collision?.solid;
  },
};
```

`stepZoneTeaching` keeps its pure `zoneIndexAtX` + state-machine core; it now reads
`verb`/`xRange`/`solved` from the map instead of hardcoding them. The teaching spec
(`useZoneTeaching.spec.ts`) loads `zones` from the map — assertions unchanged.

**Why `leave` is better than the current `pos.x >= 8`:** the gap hint already
disappears via zone transition (entering the chest zone replaces it). Deriving
completion from the zone's own xRange removes the redundancy and future-proofs the
transition logic.

---

## 4. Spawn source

The `S` cell is the single source of truth for spawn position/direction.
`checkpointService.DEFAULT_CHECKPOINT` reads it instead of the hardcoded
`(4,10,'E')`. The server's existing `spiralSearch` self-heal stays (unreachable
spawn → nearest walkable tile).

---

## 5. Multi-key door unlock (set up now, not deferred)

The door **already** supports multiple keyholes: `maybeUnlockKeyhole` checks every id
in `door.lock.requiredKeyholeIds`. So the runtime mechanic exists — only the config
needs to express it. Built for multi-key **from day one** so Phase 0 needs zero
resolver changes later.

**Config for a two-key door** (door anchors *two* groups):
```ts
defs: {
  "26,11": { id: "DOOR-1", type: "DOOR",
             link: ["a", "b"],   // door is anchor of BOTH groups
             state: { kind: "DOOR", open: false, locked: true },
             collision: { solid: true } },
  "20,8": { id: "KEYHOLE-1", type: "KEYHOLE", link: "a", ... },
  "22,8": { id: "KEYHOLE-2", type: "KEYHOLE", link: "b", ... },
  "12,8": { id: "CHEST-KEY-A", type: "CHEST", key: "a", ... },
  "14,8": { id: "CHEST-KEY-B", type: "CHEST", key: "b", ... },
}
```

### The link model (read this)
A **link group = one lock.** Every participant in a lock shares the group id —
including the door, which is the anchor.

- **`link` on an entity** may be a **string** (anchor/member of one group) or an
  **array** (the door anchors several groups). `link: ["a", "b"]` on the door means
  it is the anchor of both group `a` and group `b`.
- **`link` on a KEYHOLE** = the group it belongs to (the door is in that group).
- **`key` on a CHEST** = the group whose key it holds.

**Parser wiring (two-pass):**
1. Group every entity by its `link`/`key` id.
2. For each KEYHOLE, find the DOOR in its group → set `KEYHOLE.lock.doorId = DOOR`
   and push the keyhole into `DOOR.lock.requiredKeyholeIds`.

**Semantics of a lock** (how the engine reads `requiredKeyholeIds`):
- **AND across keyholes** — the door opens only when *every* keyhole in the group is
  used (`requiredKeyholeIds.every(kh → kh.lock.used)`).
- **Any matching key fits any hole** — within a group, a key tagged `link: "a"` can
  go into any keyhole tagged `link: "a"`.

### Two scenarios this model supports
**Realistic (what we build): key specific to its hole.**
- Group `a` = {door, KEYHOLE-1, key1} — key1 → hole1
- Group `b` = {door, KEYHOLE-2, key2} — key2 → hole2
- Door requires **both** holes. Each key is specific to its hole.

**Hypothetical (not used): generic key across holes.**
- All of key1, key2, KEYHOLE-1, KEYHOLE-2 on group `a`.
- Any key fits any hole, but the door still requires **both** holes (two unlocks).
- Not used — keys stay specific to their holes.

**`takeKey: "a"` is multi-key-correct via `keyIdByLink`.** Built in `objects.ts` from
the KEY items' `link` field (the KEY item carries `link: "a"`), mapping each group id
to that item's generated id. The teaching resolver in `useZoneTeaching.ts` reads
`keyIdByLink["a"]`, so `{ takeKey: "a" }` targets the *right* key, not any key. Phase 0
has one key (`keyIdByLink["a"]` == the only key); multi-key is the one-line extension —
add a second KEY item with `link: "b"` and the map references "b", no resolver change.

**Multi-key flow:** player must place key A in KEYHOLE-1 **and** key B in KEYHOLE-2.
Each `pi"` calls `maybeUnlockKeyhole`, which consumes that keyhole's key and marks it
`used`. The door opens only when `requiredKeyholeIds.every(kh → kh.lock.used)`.

---

## 6. Scope / effort — done

- ✅ New typed source (`INTRO_MAP`) + parser (`mapParser.ts`, synchronous, acyclic graph).
- ✅ Intro converted: grid + entities + zones + spawn.
- ✅ `useZoneTeaching.ts` builds `ZONE_TEACHES` from `INTRO_MAP.zones`; `resolveSolved`
  reads `keyIdByLink` (group-specific key) and the door's released collision.
- ✅ `checkpointService` reads spawn position/direction from the `SPAWN` entity (the `S`
  cell) in `zone.entities`, falling back to the designed center if absent.
- ✅ `objects.ts`: `link?: string` on the KEY item + exported `keyIdByLink`.
- ✅ `worldTypes.ts`: `link?: string` on `Item`; `SPAWN` added to `WorldEntityType`.
- ✅ `constants.ts`: `SPAWN` color added to `OBJECT_COLOR_MAP` (it's `Record<type,string>`).
- ✅ `mapParser.ts`: `Def` gains `dir?`; `INTRO_MAP.zones.solved` is typed
  `{ takeKey: string } | { openDoor: string }`.

Existing `map.spec.ts`, `entities.spec.ts`, `handauthored.spec.ts`, `door.spec.ts`, and
`useZoneTeaching.spec.ts` stay green — they assert the *parsed* output, which is
unchanged (the teaching spec's `KEY_ID` equals `keyIdByLink["a"]`).

No behavior change; the ASCII is hand-editable source, the parsed `zone` is the derived
runtime artifact. `seed` and `baseRuleset` remain editable in `INTRO_MAP` (neither is
hardcoded in the parser).
