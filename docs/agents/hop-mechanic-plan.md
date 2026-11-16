# Hop mechanic: `w`/`b` hop over gaps, not walls

`w` and `b` are the two-tile horizontal moves (`keyToDelta("w")` → `{ x: 2 }`,
`"b"` → `{ x: -2 }`). They are meant to **hop over a one-tile gap** (the intro
water gap at `(5,7)`), but today they hop over *anything* between the start and
the landing tile — including a closed door.

## 1. The bug (confirmed empirically)

`validateMove` (`simulation/shared/validators/move.ts`) only checks the
**landing** tile via `isWalkable`. The intermediate tile is never tested, so a
2-tile move ignores what's in the middle:

| Move | Result | Correct? |
| --- | --- | --- |
| `w` (4,7) → (6,7) over water at (5,7) | hops ✓ | ✅ teaching works |
| `w` (30,8) → (32,8) over door at (31,8) | hops ✓ | ❌ **should be blocked** |
| `ww` (30,8) → (34,8) over door | hops ✓ | ❌ **should stop at door** |
| `w` (28,8) → (30,8) over grass | hops ✓ | ✅ (preserved) |

## 2. Model: a `hoppable` flag on the tile's collision

Every solid tile/collision falls into exactly one bucket:

| Category | solid | hoppable | Examples | Walk over? | Hop over? |
| --- | --- | --- | --- | --- | --- |
| Open ground | `false` | (n/a) | grass, dirt | ✅ | ✅ |
| Gap | `true` | **`true`** | **water** | ❌ | ✅ |
| Wall / barrier | `true` | `false` (omitted) | cliff, door, chest, tree, player | ❌ | ❌ |

The rule:

```
canHopAt(pos) = !solid || hoppable === true
```

**Grass is hoppable because it is non-solid** (`collision: undefined`), *not*
because of the flag — so the flag only ever matters for solid tiles. Marking
grass `hoppable: true` would be redundant. This is why the earlier note that
"hopping over grass would become blocked" was wrong: grass stays hoppable, so
there is **no behavior change** for open ground.

## 3. Default value: `hoppable` defaults to `false` (mark gaps explicitly)

Two options were considered:

- **Implicit-true** (`undefined` treated as `true`): only walls say
  `hoppable: false`.
- **Explicit / default-false** (recommended): only gaps say `hoppable: true`;
  everything else is the default.

**Recommendation: default-false.** Reasons:

1. **Less code.** Only water is annotated; every wall, door, chest, tree, and
   player is the default. Implicit-true would require annotating *every* solid
   obstacle with `hoppable: false`.
2. **Safer default.** A new solid obstacle a designer forgets to annotate is
   blocked (safe) rather than accidentally hop-able (a subtle gameplay bug).
3. **Semantically correct.** `hoppable` is a positive assertion ("this *can* be
   hopped"); positive assertions default to false, matching how the absence of a
   `collision` object already means walkable.
4. **Future-proof.** New gaps = add `hoppable: true`; new walls = no annotation.

## 4. The hop rule

A move is a **hop** when its magnitude is 2 (`w`/`b`), i.e.
`Math.abs(delta.x) + Math.abs(delta.y) === 2`. For hops, `validateMove` adds one
check on the **intermediate** tile before accepting the landing:

```ts
const isHop = Math.abs(delta.x) + Math.abs(delta.y) === 2;
// ... after the landing passes isWalkable(next):
if (isHop) {
    const mid = { x: target.x + delta.x / 2, y: target.y + delta.y / 2 };
    if (!canHopAt(ctx, mid)) { reason = "COLLISION"; break; }
}
```

The landing tile is still validated by the existing `isWalkable`. Because the
door now blocks the intermediate tile, `ww` stops at the door (it cannot hop
*past* it), and a 2-tile `w` no longer sails over a closed door.

`canHopAt` also rejects a solid **entity** on the intermediate tile (a door
standing on grass, another player, etc.), so a door is never hop-able even
though its ground tile is grass.

## 5. Files

1. **`types/worldTypes.ts`** — `interface Collision { solid: boolean; hoppable?: boolean }`.
2. **`server/map.ts`** — new `HOP_COLLISION = { solid: true, hoppable: true }`; water band + `collisionForTile("WATER")` use it; cliff keeps `COLLISION`.
3. **`simulation/shared/helpers.ts`** — add `canHopAt(pos)` (+ extract the entity/player check from `isWalkable` into `hasSolidOccupant`).
4. **`simulation/shared/validators/move.ts`** — for hops, check `canHopAt` on the intermediate tile.

## 6. Tests

- `w` hops the one-tile water gap (existing behavior preserved).
- `w`/`b` blocked at a closed door (the bug).
- `w` blocked over a cliff.
- `ww` stops at the door (cannot hop past it).
- `canHopAt` unit: grass ✅, water ✅, cliff ❌, entity ❌.

## Done

Implemented (gate green: 96/96 tests, lint, build.types, build):

- `worldTypes.ts` — `Collision.hoppable?: boolean` (defaults false).
- `map.ts` — `HOP_COLLISION = { solid: true, hoppable: true }`; water band +
  `collisionForTile("WATER")` use it, cliff keeps `COLLISION`.
- `helpers.ts` — `canHopAt(pos)` + extracted `hasSolidOccupant` (shared by
  `isWalkable` and `canHopAt`).
- `move.ts` — hops (`w`/`b`) check `canHopAt` on the intermediate tile.
- `move.spec.ts` — new: water hop ✅, grass hop ✅, door blocked ✅ (both
  directions), `ww` stops at the door, cliff/entity `canHopAt` ❌.
- `entities.spec.ts` — position test updated to the tweaked map
  (`KEYHOLE-1` → `(17,5)`, `DOOR-1` → `(31,8)`). No behavior change for open
  ground: grass stays hop-able because it is non-solid.
