# Spawn — the "stuck on an island" fix

> The game currently drops you on the nearest walkable tile. That can be a tiny
> grass island surrounded by water. This is the plan to fix it.

## The bug

`src/server/serverState.ts` `addPlayer` calls `spiralSearch` from the join
position. `spiralSearch` (`src/simulation/shared/helpers.ts`) walks outward and
stops at the **first** walkable tile. "First" = nearest, not biggest. So you can
wake on a 3-tile grass island with water on every side and never move again.

There's a commented-out `ensureSpawnReachable` in `src/server/map.ts` — you'd
already flagged this.

## The fix

Spawn **inside the largest connected landmass**, at a central tile.

1. **Define walkable.** Non-solid tiles = `DIRT`, `GRASS`. Solid = `WATER`,
   `CLIFF` (matches `isWalkable` / `COLLISION.solid`).
2. **Flood-fill.** From every candidate tile, BFS/DFS over walkable tiles. The
   reachable set size = that landmass's size.
3. **Pick the biggest.** Choose the landmass with the most tiles.
4. **Spawn centrally.** Use the landmass centroid (or a tile near it), not the
   edge where the spiral used to drop you. This is what removes the "stuck in a
   corner of a tiny island" feeling.
5. **Guard.** If the biggest landmass is below a min threshold, **re-roll** the
   world seed and recompute.

## Why this, and why it's cheap here

- The map is bounded (4×4 chunks = 128×128 = 16,384 tiles) and the seed is
  fixed, so this is a **one-time computation at world init**, cached. No per-join
  cost, no regen loop.
- It *guarantees* open space instead of merely lowering the odds of an island.
- No terrain carving, no fragile band-tuning.

## Open decisions

- **Min landmass threshold** — pick a sane default, tune later.
- **Multiplayer** — all players share the one big spawn landmass (fine, since it's
  one world). No need to spread spawns.
- **Streaming worlds (future)** — if the world grows unbounded, flood-fill the
  *reachable* region on spawn by loading chunks on demand, pick the largest
  reachable candidate, re-roll if small. Same idea, lazy evaluation.

## Notes for implementation

- `getTileByWorldCoords` / `getChunkByWorldCoords` already exist in
  `src/simulation/shared/helpers.ts` + `src/services/chunk.ts` — reuse them.
- The whole map is already loadable via `chunkService.getMap(zone, config)`
  (`src/services/chunk.ts`) — iterate tiles once, build a walkable grid, then
  flood-fill.
- Keep the spawn decision in server code (authoritative); the client just reads
  the assigned `player.pos`.
