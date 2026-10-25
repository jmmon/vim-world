# Architecture

## Stack

- Qwik 1.19 + Qwik City, Vite 7, TypeScript 5.4 (strict), Tailwind 4.
- Rendering: SSR entry `src/entry.ssr.tsx`, client entry `src/entry.dev.tsx`,
  production preview `src/entry.preview.tsx`.
- Runtime: custom Node server (`src/entry.node-server.tsx`, `adapters/node-server`)
  hosting Qwik City plus a websocket server. `server/` is build output; do not
  edit it.
- Tests: Vitest 0.34. Config lives in `vite.config.ts`.

## Runtime shape

The world lives in server memory. The client renders a viewport and predicts
locally; the server is authoritative.

```
keydown → VimFSM (src/fsm) → action → ws message (seq, clientTime)
  → server validate (src/simulation/server/validators)
  → per-player actionQueue → tick processing (src/simulation/shared/loop)
  → ack(seq) → client reconciles, drops acked actions
```

- Server loop: `setInterval` every 50ms (`src/server/serverLoop.ts`).
- Movement: 20 ticks/second, at most 3 steps per tick (`MOVEMENT_CONFIG` in
  `src/simulation/shared/loop/loop.ts`). A count like `10j` expands across
  ticks and acks arrive per partial completion.
- AFK ladder: `src/server/wss/handleAfkDisconnect.ts` warns, then requests a
  checkpoint, then terminates. Checkpoint persistence is
  `src/server/checkpointService.ts`.
- Dev server (`plugins/dev-server.ts`) mounts the same websocket and tick loop
  through Vite so multiplayer works without a build. Editing server modules
  restarts the loop and resets the in-memory world; that reset is expected.
- Latency testing: `VIMWORLD_LAG_MS` / `VIMWORLD_LAG_JITTER_MS`, or toxiproxy
  via `toxiproxy.json` (see README).

## Module layout

| Path                     | Role                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `src/routes/`            | Qwik City routes and endpoints                               |
| `src/components/`        | UI components (canvas, menu, inventory, username)            |
| `src/hooks/`             | Qwik hooks: websocket, dispatch, seq, render loop, vim FSM   |
| `src/fsm/`               | Vim finite state machine and transition table                |
| `src/simulation/client/` | client-side action send, sessions, movement, viewport        |
| `src/simulation/server/` | server-side validation, session and correction types         |
| `src/simulation/shared/` | loop, physics, action expansion, shared validators           |
| `src/server/`            | world state, tick loop, websocket handling, checkpoints, map |
| `src/services/`          | rendering (canvas draw), HTTP, chunking, origin helpers      |
| `src/types/`             | shared world and websocket types                             |
| `src/utils/`             | math, color, misc helpers                                    |
| `src/cookbook/`          | experiments kept for reference; not production path          |

## Invariants

- Sequence numbers are monotonic per client session. Stale acks and stale
  disconnects must not mutate current state (`src/simulation/client/sessions.ts`).
- The server owns world state; clients only predict. Any disagreement resolves
  through server corrections, not client authority.
- The tick loop must stay under 100ms per tick (there is a console assertion).
  Avoid synchronous I/O inside tick handlers.
- Everything is in memory. There is no database; checkpoints serialize players.
- Shared code under `src/simulation/shared/` must run in both browser and Node:
  no DOM-only or Node-only APIs there.
