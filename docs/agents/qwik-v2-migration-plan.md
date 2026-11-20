# Qwik 1.19 → Qwik 2.0 RC migration

Target: `@qwik.dev/core@2.0.0-rc.5` + `@qwik.dev/router@2.0.0-rc.5`.

This is a **real v2 adoption**, not a v1-compat shim: every compat default the
migrator writes gets deleted, and the folder layout is fixed so v2's
server-only guard actually protects the in-memory world.

---

## 0. Pre-flight

The tree already holds uncommitted work:

```
 M package.json
 M pnpm-lock.yaml
?? src/server/playtest/
?? docs/agents/playtest-spec.md
?? more-notes.md
```

Commit or stash that **first** (`git stash push -u`), on a branch, before any
step below. Per `AGENTS.md` the agent must not run `git commit`, `git push`, or
`gh`; each phase is followed by a human commit.

Order matters: the restructure in phase 3 is not polish. v2 hard-fails the
client build when client code imports `src/**/server/**`, and this repo has
~20 client modules importing `~/server/map`. Without the move, `pnpm
build.client` cannot pass.

---

## 1. Dependency bump

In `package.json` `devDependencies`, pin exact versions (no `^` on Qwik — the
router peer-depends on the exact core version):

| Package                | From        | To            | Why |
| ---------------------- | ----------- | ------------- | --- |
| `@qwik.dev/core`       | `@builder.io/qwik@^1.19.0` | `2.0.0-rc.5` | target |
| `@qwik.dev/router`     | `@builder.io/qwik-city@^1.19.0` | `2.0.0-rc.5` | peer pins core exactly |
| `eslint-plugin-qwik`   | `^1.19.0`   | `2.0.0-rc.5` | exports `qwikEslint9Plugin` unchanged |
| `vite`                 | `7.3.1`     | `8.3.8`       | core peer `>=8 <9` |
| `vitest`               | `^0.34.6`   | `4.1.12`      | core peer `>=2 <5` — **do not** take vitest 5 |
| `@vitest/ui`           | `^0.34.6`   | `4.1.12`      | match vitest |
| `tailwindcss`          | `^4.1.4`    | `4.3.5`       | |
| `@tailwindcss/vite`    | `^4.1.4`    | `4.3.5`       | ≥4.3.4 is the first release with peer `^8`; 4.1.4 breaks on Vite 8 |
| `typescript`           | `5.4.5`     | `5.9.3`       | |
| `vite-tsconfig-paths`  | `^4.2.1`    | `6.1.1`       | v4 predates Vite 8 |

Leave `@types/node@20.19.0` alone (nothing in the build needs Node 22 types),
and keep every Qwik package in `devDependencies` — full-checkout deploy bundles
them, and `vite.config.ts`'s `errorOnDuplicatesPkgDeps` still enforces it.

**Do not take TypeScript 7.** `npm view typescript version` reports `7.0.2`
(the native compiler port), but `typescript-eslint@8.73.0` — the newest —
peers `typescript: >=4.8.4 <6.1.0`, and the installed `8.38.0` peers
`<5.9.0`. `eslint.config.js` sets `projectService: true`, so lint needs a
supported compiler. `5.9.3` is already slightly above `8.38.0`'s declared
range and works with a peer warning; if that warning is unwanted, bump
`typescript-eslint` to `8.73.0` in the same commit and expect a few new rules
to fire.

Update `engines` to `"^22.12.0"`: Vite 8 needs `>=22.12.0`, Qwik 2 needs
`^20.3.0 || >=21`. `mise` already runs Node 22.34.4.

```
pnpm install
```

Then confirm the peer graph is clean before touching code:

```
pnpm why @qwik.dev/core
```

---

## 2. Run the migrator, then delete everything it hedges

```
pnpm dlx @qwik.dev/core@2.0.0-rc.5 migrate-v2
```

Pin the CLI to `rc.5` rather than `@latest`, so the codemods match the installed
packages. Review its diff — expected:

- `@builder.io/qwik` → `@qwik.dev/core`, `…/qwik-city` → `@qwik.dev/router`
  (incl. `/vite`, `/middleware/node`, `/adapters/node-server/vite`)
- `createQwikCity` → `createQwikRouter`
- `jsxImportSource` in `tsconfig.json`
- `QwikCityProvider` → `QwikRouterProvider` (both still exported; take the new one)

Then **revert every compat default it adds**:

| Migrator adds | Action |
| --- | --- |
| `streaming: { inOrder: { maximumInitialChunkSize: 50000, maximumChunkSize: 30000 } }` | delete; v2 default is `{ inOrder: { strategy: 'auto', maximumInitialChunk: 20000, maximumChunk: 10000 } }` |
| `strictLoaders: false` | delete; repo has zero loaders, so `true` is free |
| `requestBodyLimit: Number.MAX_SAFE_INTEGER` | delete; 10 MiB default is fine (only small form posts) |
| `viewTransition` prop on the provider + `:root{view-transition-name:none}` in `global.css` | delete both; no view transitions in use |
| `<Link prefetchData="visible">` edits | revert; no `<Link>` in the repo |
| head-wrapper changes in `root.tsx` | revert if it added any |
| `src/plugins/plugin@000-v1-errors.ts` (or `plugin@000-v1-errors.ts`) | delete |
| `src/routes/layout.ts` with a `useV1NavigationProbe` loader | delete the file; the repo has no root `layout.tsx` and no loaders, so the probe is pure overhead |

`notFound` from `createQwikRouter` is deprecated in v2 because `router` now
answers 404 itself, so drop it from the chain (phase 4).

---

## 3. Folder restructure — `src/server` → `src/game`

One folder named `src/server` cannot survive v2: 43 client files import
`~/server/*`, and v2 excludes **everything** under `src/**/server/**` from the
client bundle. Split by reachability instead of by "it runs on a server".

```
src/game/            shared, client-reachable domain code
src/game/server/     live in-memory state and socket/loop code
```

`src/game/server/**` still matches v2's guard, so `serverState`,
`serverLoop`, `wss/` and `playtest/` stay protected.

### Mapping

Shared — moved with no code change (verified client-reachable):

| To | Importers from client code |
| --- | --- |
| `src/game/map.ts` | `services/draw/{map,objects,overlay,utils}`, `simulation/client/viewport`, `simulation/shared/helpers`, `types/worldTypes`, `hooks/useZoneTeaching`, `routes/test/offscreen-map` |
| `src/game/mapParser.ts` | `map.ts` |
| `src/game/types.ts` | `components/canvas1`, `hooks/useState`, `simulation/**`, `services/http` |
| `src/game/objects.ts` | `services/draw/objects`, `simulation/shared/actions/door`, `hooks/useZoneTeaching` |
| `src/game/constants.ts` | `services/origin`, `entry.node-server` |
| `src/game/base58.ts` | `objects.ts` |
| `src/game/{map,entities,handauthored}.spec.ts` | tests next to subject |

Server-only — moved into `src/game/server/` (verified **no** client importer
today):

`serverState.ts`, `serverLoop.ts`, `ai.ts` (zero importers — leave it where it
lands, deleting it is a separate call), `wss/{ack,handlers,helpers,wss,handleAfkDisconnect}.ts`,
`wss/handleAfkDisconnect.spec.ts`, `playtest/**`.

`src/routes/api/{player,map}/index.tsx` keep importing `~/game/server/…`
directly. Both are endpoint-only modules (no `component$`), which v2 explicitly
allows to import server-only code; `pnpm build.client` in phase 7 is the proof.

### `checkpointService.ts` split (forced, not optional)

It currently mixes a shared pure helper with a module-level `Map` cache and
`~/server/map`'s SPAWN lookup, and two **client** hooks import it
(`useRenderLoop.ts`, `useWebSocket/dispatch.ts`). Once the store lives under
`src/game/server/`, the client import is a build error. Split:

- `src/game/checkpoint.ts` — `PlayerCheckpoint` type + `fromPlayer()` (pure).
  Six modules import the type (`simulation/client/types`,
  `simulation/shared/helpers`, `types/wss/{client,server}`, `wss/ack`), so the
  type must live here too.
- `src/game/server/checkpointStore.ts` — everything stateful:
  `DEFAULT_CHECKPOINT` (+ its `SPAWN` lookup), `checkpointCache`,
  `_loadCheckpoint`, `_createDefaultCheckpoint`, `loadOrDefault`, `update`,
  `toPlayer`, `toCheckpoint`, `newPlayerSession`, and the default export (keep
  the `checkpointService` name so call sites don't churn).

Call sites to re-point: `useRenderLoop`, `useWebSocket/dispatch`,
`routes/api/player`, `serverLoop`, `wss/{handlers,helpers}`.

### Import rewrites (69 specifiers)

59 × `~/server/x`, 6 × `../server/x`, 4 × `./server/x`. Do not hand-edit:
write a throwaway `/tmp` codemod that resolves each specifier against its own
file, remaps `src/server/<x>` → `src/game/<x>` or `src/game/server/<x>` per the
table above, and recomputes the relative form. Then `tsc` lists anything missed.

Also update:

- `plugins/dev-server.ts` — `ssrLoadModule("/src/server/wss/wss.ts")` etc. →
  `/src/game/server/…`; `WATCHED = ["src/game", "src/simulation", "src/types"]`
  so map edits still reset the world.
- `package.json` `"playtest"` → `tsx src/game/server/playtest/cli.ts`.
- `src/entry.node-server.tsx` imports.

`git mv` will not move `src/server/playtest/` (it is untracked) — use plain
`mv` for that subtree.

---

## 4. Entry points, vite config, adapter

`vite.config.ts`:

```ts
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
```

Keep `tsconfigPaths`, `tailwindcss`, `devGameServer`, the dev `host: true` and
both cache-header blocks as they are. Keep `errorOnDuplicatesPkgDeps`.

`adapters/node-server/vite.config.ts`: swap the two imports to
`@qwik.dev/router/adapters/node-server/vite` and `@qwik.dev/router/vite`. The
rollup input stays `["src/entry.node-server.tsx", "@qwik-city-plan"]` — the
virtual id is unchanged in v2.

`src/entry.node-server.tsx`:

```ts
const { router, staticFile } = createQwikRouter({
    render,
    qwikCityPlan,
    static: { cacheControl: "public, max-age=31536000, immutable" },
});
...
staticFile(req, res, () => router(req, res, () => {}));
```

`notFound` is gone from the chain (v2 `router` writes the 404 itself). Keep the
`upgrade` handler and `initializeWss`/`serverLoop` calls untouched.

**Port: no change.** `src/server/constants.ts`'s `API_PORT` is already the
single source (used by `entry.node-server.tsx` and `services/origin.ts`) and
already honours `VITE_API_PORT` in prod. There is no `PORT ?? 3004` anywhere in
this repo — that is starter scaffolding we never adopted. Only the import path
changes.

`src/entry.preview.tsx`: `createQwikRouter`, drop nothing else.

`src/entry.dev.tsx`: delete — v2 has no dev-input mode, so the file is dead
(`qwikVite()` is called without options and never references it).

`src/root.tsx`: `QwikRouterProvider` from `@qwik.dev/router`, no
`viewTransition` prop. The `head:` export in `src/routes/index.tsx` stays a
static object — v2 still accepts `DocumentHeadValue`.

---

## 5. Websocket init: `useTask$` → `useVisibleTask$`

`src/hooks/useWebSocket/useWebSocket.ts:55` currently does

```ts
useTask$(({ cleanup }) => { ... }, { eagerness: 'load' });
```

In v1.19 that only works because `useRunTask` maps `'load'` to a
`qinit` document listener on the server. v2's `TaskOptions` is
`{ deferUpdates?: boolean }` — the option and the resume mechanism are gone, so
the socket would never open on a direct load.

Replace with the pattern already used in `useRenderLoop.ts`:

```ts
// eslint-disable-next-line qwik/no-use-visible-task
useVisibleTask$(({ cleanup }) => { ...body unchanged... },
    { strategy: 'document-ready' });
```

`isServer` early-return, URL resolution, `onopen`/`onmessage`, and the
`cleanup$` wiring all stay as-is. `document-ready` is the right strategy: the
socket must open as soon as the page loads, not when the canvas scrolls into
view. `qwik/no-use-visible-task` is `warn` in the v2 recommended config, hence
the disable comment.

Behaviour note: `useVisibleTask$` forces that component's JS to be fetched on
first resume — same as the `qinit` listener did in effect, so no added cost.

---

## 6. Toolchain touch-ups

- `tsconfig.json`: `jsxImportSource: "@qwik.dev/core"`. Nothing else.
- `eslint.config.js`: unchanged. `qwikEslint9Plugin.configs.recommended` is
  still exported by `eslint-plugin-qwik@2`.
- Leave the `"**/server"` ignore alone. It already silently skips
  `src/server/**`; after the move it will skip `src/game/server/**` too. Fixing
  it (`"**/server"` → `"/server"`) would suddenly lint that folder and probably
  fail — separate cleanup, see phase 8.
- Do **not** run repo-wide `pnpm fmt`. Prettier-check only touched files.
- `pnpm-lock.yaml` will churn heavily; expected.

---

## 7. Verification gate

Run in this order, fix forward:

```
pnpm install
pnpm build.types
pnpm test.unit
pnpm lint
pnpm build.client          # proves the server-only guard is satisfied
pnpm build                 # client + server + types
```

Then behaviour, because typecheck cannot see any of it:

1. `pnpm dev` — socket connects on a **direct** URL load (not just after a
   click), other players move, `w`/`b` hops still work.
2. Same on `pnpm serve` after a build — this is the path that regressed in v1
   and is why `eagerness: 'load'` existed.
3. `/canvas1` still fetches the map through `useResource$`.
4. Hit an unknown URL: expect a real `404` with `Not Found`, no crash. v2 sets
   `{ status: 404, message: "Not Found" }` when no route matches, so no
   `404.tsx` is needed.
5. `pnpm playtest` still runs from the new path.

---

## 8. Follow-ups (explicitly out of scope)

- `useResource$` in `src/routes/canvas1/index.tsx` → `routeLoader$`, with
  `src/routes/api/map/index.tsx` folded in. Do it after the migration is green,
  as its own change.
- Remove the now-unused `src/routes/api/map` endpoint if the loader lands.
- `eslint.config.js` `"**/server"` → `"/server"` so `src/game/server/**` is
  linted again.
- `src/server/ai.ts` (now `src/game/server/ai.ts`) has zero importers — delete
  or wire up deliberately.
- Optional: `@types/node` → `^22` to match the runtime.

---

## 9. Decision log

| Question | Answer |
| --- | --- |
| Split `checkpointService` now? | Yes — forced by the move. Client keeps `PlayerCheckpoint` + `fromPlayer` in `src/game/checkpoint.ts`; the cache and `SPAWN` stay server-side. |
| Keep the Qwik packages in `devDependencies`? | Yes, unchanged. Full-checkout deploy bundles them. |
| v2 default 404 OK? | Yes. `router` writes `status: 404`, body `Not Found`. No `404.tsx`. |
| Port handling | No change. `API_PORT` already centralised; the starter's `PORT ?? 3004` was never adopted. |
| Static caching | No change. Keep `static.cacheControl`; v2's option shape is identical. |
| `useResource$` → `routeLoader$` during migration? | No. Follow-up. |
| TypeScript 7.0.2? | No. `5.9.3`. No `typescript-eslint` release peers TS 7, and lint is type-aware. |
| `createQwikCity` vs `createQwikRouter` | `createQwikRouter`; `createQwikCity` is deprecated until v3. |
| `QwikCityProvider` vs `QwikRouterProvider` | `QwikRouterProvider`; the old name is a deprecated alias. |
| Streaming | Take the v2 default (`strategy:'auto'`, 20k/10k). If chunked HTML breaks the canvas page, fall back to `streaming: { inOrder: { strategy: 'disabled' } }` and record why. |

---

## 10. Risks

- **Vite 8 + Tailwind:** `@tailwindcss/vite@4.1.4` peer-depends on Vite
  `^5.2 || ^6 || ^7` and will break the install/build. Both must move to
  `4.3.5` in the same commit.
- **Vitest 5 exists** (5.1.0) but Qwik 2's peer range is `>=2 <5`. Stay on
  4.1.12.
- **TypeScript 7 exists** (7.0.2) but `typescript-eslint` stops at `<6.1.0`.
  Stay on 5.9.3 or lint breaks.
- **Endpoint imports under the guard:** `src/routes/api/**` importing
  `~/game/server/**` is legal for endpoint-only modules, but it is the one
  claim in this plan that only the actual client build can confirm. If
  `pnpm build.client` rejects it, the escape hatch is a thin `server$`
  wrapper, not a folder reshuffle.
- **Streaming changes the SSR response shape** for a canvas app whose first
  paint matters. Watch for a flash or a hydration-order regression on `/`.
- **`git mv` vs untracked `playtest/`:** the playtest tree is untracked, so
  `git mv` fails on it and `git stash -u` is the safer pre-flight.
- **No `src/routes/layout.tsx` today.** If the migrator creates one for its
  navigation probe, deleting it is correct — but re-check that nothing else
  landed in it.
