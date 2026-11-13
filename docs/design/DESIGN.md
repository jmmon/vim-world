# vim-world — Design Document

> Source of truth for *what this game is* and *why*. Engineering decisions should
> trace back to one of these. Last updated Nov 2026.

---

## 1. The one-liner

A multiplayer world you navigate with **Vim**. You learn real Vim motions
(`hjkl`, `10j`, `yi"`, `di"`, `f{`…), and those motions *are* your verbs — you
pick things up, move items between containers, traverse, and interact. The fun
is the **flow of getting good at Vim**, plus the **wonder of exploring an
endless shared world** with other people quietly in it.

**Feel we're going for:** *flow / mastery* + *wonder / discovery*. Calm, curious,
not combat. Think "a place to get lost" more than "a game to win."

---

## 2. Core pillars (in priority order)

1. **Vim is the whole control language.** Not a skin over arrow keys. Every
   interaction is a real Vim command. Skill in Vim = skill in the game. This is
   the unique hook — never let it become a generic 2D MMO with Vim decals.
2. **Flow.** The friction between "thinking about the key" and "just doing it"
   must vanish. Movement and interaction should become reflex. `10j` should
   *feel* faster than `j`, and you shouldn't have to think about why.
3. **Wonder.** An endless world to get lost in. People, coastlines, things to
   find. Presence of others is the magic, not a leaderboard.
4. **Presence + items, no combat.** You see other players, share the world,
   move things around them. No tag, no fighting, no death. Low-conflict, calm,
   like a shared space (the QWIK ethos), not WoW.

If a feature fights a pillar, drop it.

---

## 3. What players actually do (minute to minute)

- **Move** with Vim motions — `h/j/k/l`, `w`, `b`, counts like `10j`, `gg`/`eg`.
- **Interact** with Vim operators — `yi"` (yank inside), `di"` (delete inside),
  `ci"` (change), `f{` / `f[` (find target), `f"` / `F"` (move to mark).
- **Handle items** — pick up objects, pick up items *from* containers, place
  items *into* containers. (Already implemented: `src/simulation/shared/actions/interact.ts`.)
- **Explore** — walk the endless world, discover points of interest, see other
  players doing the same.
- **Unlock** — pick up an item (e.g. a key), carry it, place it on a target
  (e.g. a door) to open a path. Items gate the world.
- **Hang out** — be in the same space. Chat/expression later.

There is **no win state, no combat, no death.** Progression = reach more of the
world and get better at Vim.

---

## 4. The learning arc: tutorial → open world

The intended journey:

```
learn basic motions (tutorial)  →  learn motions + interactions (tutorials)
                                   →  unlock the open world
                                   →  explore / get lost / reach the "hard" places
```

### 4.1 Tutorial philosophy: **just-in-time**

- Teach a key **only right before the game needs it**. No upfront lecture.
- Minimal text. Player fumbles, discovers, "oh, `10j` is faster."
- Small curated maps (aim ~10) that each introduce one idea, then release the
  player into the open world.
- Tutorials are **staged**: you pass one to reach the next, culminating in the
  open-world gate. (Leaning toward this over "two separate modes.")
- **Ghost players.** Tutorials are played **solo**, but if others are online in
  the same map you see their **ghosts** — semi-transparent, walk-throughable,
  not your own instance. You can't see what keys they press, but watching a ghost
  do a `10l` might give you the idea that you can pair a number with a motion.
  Ghosts are *presence*, not a reliable teacher — we still need an NPC/sign to
  introduce a motion the first time.
- **Ghosts move like players.** Same snap movement (tile-to-tile, up to 3 steps
  per tick; a `10j` splits into `3j`×3 + `1j`). Keep snapping — it's vim-like and
  on-brand. A glide is a possible later polish, tested against multiplayer, but
  not for Phase 0. Don't build a separate glide system for ghosts — reuse the
  player movement path. Ghosts just need to be rendered **semi-transparent**.
  Readable enough to follow, cheap because it's the same code.
- **Single-key-hold.** The player can carry only **one** key at a time (extend the
  existing `carryingObjId` — it's already single-slot). This is what makes the
  two-key door a *challenge*: walk to key A, walk to the door, walk back for key
  B. Small friction, real puzzle.
- **Step through everything, but breathe.** People may be clueless. Give them a
  few seconds to try something before nudging — a brief pause, then a hint
  (help panel / sign) that shows the next motion. One interaction introduced at
  a time; never dump all four at once.
- **Wait, then nudge.** Don't show the hint immediately. Give the player time to
  try; only surface the hint after a short idle/stuck period. Respects skilled
  players, supports confused ones.

### 4.2 Progression = **unlock areas by Vim proficiency**

This is the spine that ties teaching to exploration:

- A proficient Vim user can reach places a newbie physically cannot — because the
  door requires `10j`, or `yi"` on a high ledge, or a motion combo the newbie
  hasn't learned yet.
- Newbie → taught the motion → can now reach what was locked. Progression is
  literally *getting better at Vim*, made visible in the world.
- Start small: a handful of gated regions, not a full skill tree.

> Open question: how gating is *visible* to a stuck newbie. Options: a subtle
> hint ("this needs a faster motion"), or nothing (pure discovery). Lean toward
> gentle discovery for now.

### 4.3 The door — first gating verb

The pick-up-a-key → place-on-door interaction is the seed of the whole
progression system:

- **Carry state** already exists (`player.carryingObjId` / `player.itemIds`).
  Extend it so a picked item can be a *key*.
- **A door** is a solid gate tile (CLIFF) that flips locked → open and changes
  the tile to GRASS when its linked keyhole is unlocked.
- **A keyhole** is the interactable — a wall slot *linked to a specific door*.
  It is "chest-like": it uses the same `interactable.selectors` + paste path as
  a chest. You **face** it and press `pi"` (or any target char — the exact
  character doesn't matter yet). Same motion as `yi"` from a chest, symmetric:
  *grab from chest, deposit into keyhole.*
- **Validation:** `pi"` finds the keyhole in facing range (reuses
  `findObjectInRangeByKey`), checks you carry the matching key, consumes the
  key, marks the keyhole used, and — if all linked keyholes are used — opens the
  linked door.
- **Door feel (decided):** satisfying sound + animation, the path is revealed,
  and the **key is consumed** on use (no carrying it forever — commitment).
- **Why this matters:** the door is where Vim skill becomes a *physical gate*.
  A door that only opens after a `10j` dash, or a motion combo a newbie hasn't
  learned, makes §4.2's "unlock areas by proficiency" tangible.
- **Start small:** one key, one keyhole, one door, in the hand-made intro map.

#### Keyhole ↔ door linking (the 2-key mechanic, deferred past Phase 0)

A keyhole is **linked to one door** via a `doorId`. This is what enables the
Zelda-like multi-key door without extra machinery:

- A door can have **several keyholes** scattered around it (a few tiles to the
  left/right in the wall). **All** must be unlocked for the door to open.
- **The player doesn't know which slots link to which door** — that's discovery.
  They just try keyholes and see what opens.
- Single-hold (one key at a time) already makes this a puzzle: walk to key A,
  unlock its slot, walk back for key B.

Phase 0 stays single-key/single-door; the link field is added now so the same
code serves the 2-key version later.

### 4.4 Teaching motions by forcing discovery

Just-in-time teaching means the **world itself** teaches the key — no text box.

- **Introduce `N[direction]` with a small number first** (`3l`), then let the
  player discover that a bigger count (`10l`) gets further.
- **Force it:** place an *impassable-without-a-count* obstacle in front of the
  target. Concretely, a **pushback / current tile** — e.g. `< < T` where `A` is
  the player, `<` tiles push you back one step each, and `T` is the target. A
  plain `l` never reaches `T`; only `3l` (or more) does. Land on a pushback tile
  and you slide back to start.
- **Fantify it:** don't call it a "pushback tile." Something in-world — a gale,
  a river draft, thorns that shove — that reads as fantasy, not a mechanic.
- **Guide:** a non-player guide (static figure / sign) demonstrates the motion
  once, since a newbie won't guess that a number precedes a motion.
- **Feedback:** the player *is* the cursor, so there's no hover. Give
  interactable/targetable tiles a **glow** that invites investigation — the
  visual language for "this is worth going to."

### 4.5 The staged intro map (Phase 0 beat sheet)

One hand-made map, split into **zones**, each teaching exactly one thing. The
player earns the next zone by completing the current one. **Phase 0 = 4 zones**
(the gale is deferred — see below):

1. **Zone 1 — `hjkl`.** Move in four directions to reach a goal. (Opening beat:
   brief pause, then a help panel showing `hjkl`.)
2. **Zone 2 — `w` / `b`.** A gap only a hop crosses.
3. **Zone 3 — `yi"` (pick up a key from inside a chest).** Yank operator intro.
4. **Zone 4 — the keyhole.** Place the key (`pi"`) on the keyhole. Key is
   consumed, the linked door opens with sound + animation, the path is revealed
   → next zone.

> **Deferred:** the gale (pushback tiles, `3l`/`10l`) was zone 4 in the original
> beat sheet. It's real new movement-validator work, so it moves to Phase 0.5 —
> after the door proves the core loop is fun. The teaching-by-forcing idea
> (§4.4) stays; it just lands later.

### 4.6 Drafted skill arc (tentative — for you to correct)

One idea per map. Each map = one movement beat + one interaction beat, ramping
difficulty. This is a draft; treat it as a starting point, not a spec.

| Map | Movement beat | Interaction beat | Zelda-like twist |
|---|---|---|---|
| **0 — Spawn** | `hjkl` | — | Brief pause, then help panel. Nothing blocks you. Just move. |
| **1 — The Gap** | `w` / `b` (hop) | — | A 1-tile gap; `h/j/k/l` can't cross, `w` can. |
| **2 — The Chest** | `hjkl` | `yi"` (yank item from inside) | Pick up the first key. |
| **3 — The Door** | — | `pi"` (deposit key into keyhole) | One key, one keyhole, one door, consumed. The "aha." **Phase 0 boss.** |
| **3.5 — The Gale** | `3l` / `10l` (counts) | — | Pushback tiles force a count. Introduce `3l` via guide; discover `10l`. **Deferred to Phase 0.5.** |
| **4 — Two Keys** | `w`/`b` + counts | `yi"` twice | A door needing **two** keys in two reachable spots. Single-hold: you can
  only carry **one** key at a time, so you must walk back and forth. Planning +
  mild challenge. |
| **6 — The Mark** | `'` / `"` (jump to mark) | — | Return to a spot you marked. |
| **7 — The Find** | `f{` / `f[` (find char) | — | Target by character, not tile. |
| **8 — The Change** | `ci"` / `di"` | — | Delete/change inside an object. |
| **9 — The Vault** | *(all of the above)* | *(all)* | A gauntlet combining beats. The final tutorial boss. |

**Principles baked in:**
- One new input per map; the rest reviews prior beats.
- Difficulty ramps with *layout* (gales, multi-key doors), not new verbs.
- The gauntlet (map 9) is where "unlock areas by proficiency" pays off — a
  fluent Vim user sails through; a newbie just passed the earlier gates.

---

## 5. Vim as the verb set (design intent)

Design in-game actions around **standard Vim motions/operators**, so learning
Vim and playing the game are the same activity:

| Vim concept | In-game role |
|---|---|
| `hjkl` | basic movement |
| `w` / `b` | jump / step |
| counts (`10j`, `5l`) | faster / multi-step movement |
| `gg` / `eg` | jump / dive (top / bottom of something) |
| `yi"` / `di"` / `ci"` | yank / delete / change *inside* an object |
| `ya"` / `da"` | yank / delete *around* an object |
| `f{` / `f[` / `f"` | find / move to a target |
| `"` / `'` / `` ` `` | marks / jump to position |
| `:` command line | chat / commands (later) |

The FSM already models operators + `i`/`a` qualifiers + counts + `f`/`F`
(`src/components/inventory/utils/FSM.ts`, `src/fsm/types.ts`). Build new verbs by
extending that, not by adding a parallel system.

**TODO:** audit current actions (`interact.ts`, `command.ts`) and list which
motions are implemented vs. still to design. Then decide the first ~6 verbs to
implement for the intro.

---

## 6. The world & engine

- **One world, one seed.** Everyone spawns in the same area and shares it. This
  is a feature — a shared home, not a bug.
- **Infinite / ever-expanding** in spirit (Minecraft-like), but with practical
  limits. Streaming chunks (`src/services/chunk.ts`) are already built — the
  engine goal is to keep it performant at scale.
- **Engine as a learning goal.** A performant, streaming, authoritative-server
  engine is itself a reason this project exists. Balance engine investment vs.
  content — see §8.
- **Scale target:** comfortable for many concurrent players; aim to survive
  up to ~100 at once even if that never happens.

### 6.1 The spawn bug (why this doc exists)

The current spawn (`src/server/serverState.ts` → `spiralSearch`) lands the player
on the **nearest** walkable tile. Nearest ≠ biggest → you can wake up on a tiny
grass island surrounded by water, stuck. The fix, once we commit to the design,
is: **flood-fill connected land, spawn inside the largest landmass, at a central
tile.** If the biggest landmass is below a threshold, re-roll the seed. This is a
one-time computation per world (seed is fixed), so it's cheap. See
`docs/design/SPAWN.md` for the concrete plan.

---

## 7. Scope & phase plan (keeping it exploratory)

You said "keep exploring," so this is a *directional* plan, not a deadline:

- **Phase 0 — nail the feel.** One **fully hand-made** map, the intro motions
  (`hjkl`, `w`, `10j`), and one interaction that closes a loop: **pick up a key,
  carry it, place it on a door to unlock it** (`yi"` / `pi"`). Make movement feel
  like *joy* and leave a curiosity hook ("I want to do more"). This is the
  highest-leverage slice — it tests whether the whole game is fun.
- **Phase 1 — the arc.** ~3–5 tutorial maps (just-in-time), the "unlock areas by
  proficiency" gate, and a modest open world instance.
- **Phase 2 — wonder.** Points of interest, more gated regions, more verbs,
  presence polish (see others, chat).
- **Ongoing — engine.** Keep streaming performant as the world grows.

**Cutting rule:** when scope creeps, cut breadth (more maps, more regions) before
we cut depth (a verb feeling good, a tutorial teaching clearly).

---

## 8. Open questions (still undecided)

- **Player interaction depth.** Settled on *presence + items* for now. If we add
  anything, it's cooperative (open something together) or expressive (chat),
  not competitive.
- **Tutorial vs open world: staged vs two modes.** Leaning **staged** (learn →
  unlock → explore).
- **How a stuck newbie learns a required motion.** Gentle hint vs. pure discovery.
- **Movement glide.** Smooth glide is deferred to later (`w`/`b` hop over a tile,
  so a continuous glide would be visually wrong). Grid-snappy for Phase 0.
- **Door / lock mechanics.** How a key + door works as a verb (see §4.2).
- **Seeds per region.** One seed for now; if we want biome variety, could vary
  the seed per chunk/region (the noise system already keys off chunk coords).
- **Hard world limit.** How far can you go before re-roll / edge? TBD.
- **What "wonder" content looks like.** POIs, landmarks, hidden things — TBD.

---

## 9. Where things live (map to code)

| Concern | Where |
|---|---|
| Vim state machine | `src/fsm/`, `src/components/inventory/utils/FSM.ts` |
| Vim actions (move/interact/command) | `src/simulation/shared/actions/` |
| Server loop, validation | `src/simulation/shared/loop`, `src/simulation/server/validators` |
| World state, player add/spawn | `src/server/serverState.ts` |
| Map generation (chunks, noise) | `src/server/map.ts`, `src/services/chunk.ts` |
| Rendering | `src/services/draw/`, `src/components/canvas1/` |
