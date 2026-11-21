# vim-world

Multiplayer Vim game: a Qwik City SSR frontend and an in-memory Node websocket
server share one tick simulation. The intro map teaches Vim motions one zone at
a time.

## Language

### Zone teaching

**Zone**:
A contiguous horizontal region of the intro map that teaches exactly one
motion, identified by its x-range.
_Avoid_: area, region, room

**Zone Hint**:
The single-line contextual teaching box at top-center showing the current
zone's verb.
_Avoid_: teaching panel, hint box, tooltip

**Verb**:
The key or motion a zone teaches, shown as the Zone Hint's text.
_Avoid_: key, command, move

**Solved**:
A zone whose correct action the player has performed (right key taken, right
door opened); its Zone Hint auto-dismisses.
_Avoid_: completed, done

**Sit-then-nudge**:
The fallback that re-shows the Zone Hint after the player idles on one tile
for a fixed time with no successful action.
_Avoid_: stuck timer, idle hint

### Movement & collision

**Gap**:
A tile that blocks walking but can be hopped over with `w`/`b` (water).
_Avoid_: hole, pit

**Barrier**:
A tile that blocks both walking and hopping (cliff, closed door, tree, chest,
player).
_Avoid_: obstacle, blocker

**Hoppable**:
Collision property marking a solid tile as hop-over-able; default false, so
every Barrier is non-hoppable by omission.

### HUD rendering

**Overlay Canvas**:
The persistent HUD canvas layered above the world canvas; boxes are
drawn-and-erased in place, not repainted every frame.
_Avoid_: HUD layer

**Overlay Box**:
A named rectangle drawn on the Overlay Canvas with a draw/close pair (fps,
dev stats, help, help hint, Zone Hint, AFK, statusbar).
_Avoid_: HUD widget, panel
