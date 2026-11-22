# Qwik v1.19 → v2 rc.5 API delta

Created: 2026-11-21 20:21

Companion to `docs/agents/qwik-v2-migration-plan.md`. That file is the
**procedure** (phases, gates, decisions). This file is the **rename table**: what
moved, what is source-compatible, and which symbols the repo actually touches.
Read this one when you need to know whether a specific import survives.

Headline: **v2 rc.5 is close to source-compatible for this repo.** Every symbol
it imports still exists. The two things that actually bite are the server-only
import guard (§4) and the removed `useTask$` `eagerness` option (migration plan
phase 5) — both are compile-time or already covered.

## How this was verified

Not from docs prose. Diffed against the shipped type declarations:

- v1 = installed `node_modules/@builder.io/qwik@1.19.0/dist/core.d.ts`,
  `node_modules/@builder.io/qwik-city@1.19.0/lib/index.d.ts` and their subpath
  `.d.ts` files.
- v2 = `@qwik.dev/core@2.0.0-rc.5` and `@qwik.dev/router@2.0.0-rc.5` unpacked
  from the npm registry. Public surface = the file each `package.json` `exports`
  entry points at (`public.d.ts` for core root, `server.d.ts` for `/server`,
  `lib/index.d.ts` for the router). `dist/core-internal.d.ts` holds the full
  declarations, including the ones no longer public.

Re-derive with:

```
npm pack @qwik.dev/core@2.0.0-rc.5 @qwik.dev/router@2.0.0-rc.5
```

Then diff the `export {` block in `core/package/public.d.ts` against the
`export declare` lines in v1's `dist/core.d.ts`. v2's `public.d.ts` is the
curated surface (93 symbols); v1's root exports 264, so a raw diff lists 190
"removed" names and looks alarming. 54 of those are `*HTMLAttributes` element
types and another 30 are `Qwik*Event` / `Native*Event` aliases; the genuinely
behavioural removals are the short list in §5.

---

## 1. Package and subpath map

| v1 specifier                                      | v2 specifier                                 | Note                                                                                |
| ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `@builder.io/qwik`                                | `@qwik.dev/core`                             |                                                                                     |
| `@builder.io/qwik/build`                          | `@qwik.dev/core/build`                       | same 3 exports: `isBrowser`, `isDev`, `isServer`. There is no `isClient` in either. |
| `@builder.io/qwik/server`                         | `@qwik.dev/core/server`                      | public surface shrinks 27 → 16 names, see §5                                        |
| `@builder.io/qwik/testing`                        | `@qwik.dev/core/testing`                     | `createDOM` unchanged (used by `src/components/example/example.spec.tsx`)           |
| `@builder.io/qwik/optimizer`                      | `@qwik.dev/core/optimizer`                   | `qwikVite` unchanged                                                                |
| `@builder.io/qwik/jsx-runtime`                    | `@qwik.dev/core/jsx-runtime`                 |                                                                                     |
| `@builder.io/qwik-city`                           | `@qwik.dev/router`                           |                                                                                     |
| `@builder.io/qwik-city/vite`                      | `@qwik.dev/router/vite`                      | `qwikCity` → `qwikRouter`; `extendConfig` unchanged                                 |
| `@builder.io/qwik-city/middleware/node`           | `@qwik.dev/router/middleware/node`           | `createQwikCity` → `createQwikRouter`                                               |
| `@builder.io/qwik-city/adapters/node-server/vite` | `@qwik.dev/router/adapters/node-server/vite` | `nodeServerAdapter` unchanged; `StaticGenerateRenderOptions` → `SsgRenderOptions`   |
| `@builder.io/qwik-city/service-worker`            | —                                            | **subpath removed** from v2 `exports`. Repo does not use it.                        |

The old names are **deprecated aliases, not deletions**: `createQwikCity` is
literally `typeof createQwikRouter`, and `qwikCity` / `QwikCityProvider` are
still exported, each tagged `@deprecated … Will be removed in v3`. So a
half-done migration still typechecks in rc.5 — the rename is cosmetic today and
the deadline is v3.

**CLI surface.** `package.json`'s `build.server` runs `qwik check-client src
dist`, which is not mentioned anywhere in the migration plan. It survives: v2's
`dist/cli.mjs` still registers `check-client` (alongside `build`, `preview`,
`route`, and the new `migrate-v2`). So `build.server` needs no change beyond the
import paths in `adapters/node-server/vite.config.ts`.

---

## 2. Every Qwik symbol this repo imports

Audited over the 38 `@builder.io/qwik*` import sites in 32 files under `src/`,
`adapters/`, `plugins/`.

**Core (`@builder.io/qwik` → `@qwik.dev/core`)** — all 22 survive:
`$`, `QRL`, `Resource`, `Signal`, `Slot`, `NoSerialize`, `noSerialize`,
`component$`, `isBrowser`, `isDev`, `isServer`, `render`, `RenderOptions`,
`sync$`, `useComputed$`, `useOnDocument`, `useOnWindow`, `useResource$`,
`useSignal`, `useStore`, `useTask$`, `useVisibleTask$`.

`sync$` is easy to miss — it is imported in `src/components/menu/menu.tsx` and
is still in v2's public list.

Counting the bare specifier string across the whole checkout gives ~150 extra
hits, but they are all noise: `dist/` (53), `docs/` (20), `factory/` (17),
`tmp/`, `pnpm-lock.yaml`. The generated root `server/` directory contributes
none. Count `from '@builder.io/qwik…'` lines under `src adapters plugins` and
you get the real 38.

**`@builder.io/qwik/server` → `@qwik.dev/core/server`** — `renderToStream` and
`RenderToStreamOptions` (used by `src/entry.ssr.tsx`) both survive.

**Router (`@builder.io/qwik-city` → `@qwik.dev/router`)** — of 12 symbols, 10
survive: `DocumentHead`, `Link`, `RequestHandler`, `RouterOutlet`, `server$`,
`useDocumentHead`, `useLocation`, `useNavigate`, plus `extendConfig` and
`nodeServerAdapter` from their subpaths. The 2 that change are `createQwikCity`
and `QwikCityProvider` (§1).

`useNavigate` carries **no** deprecation marker in rc.5. `useQwikRouter` is new
and is what `QwikCityProvider`'s deprecation text points at, but `useNavigate`
is not flagged — see the note at the end of §6.

---

## 3. `ResourceReturn<T>`: looks like a break, is not

The type text changed and a diff-based reader will panic over it:

```ts
// v1.19
type ResourceReturn<T> =
    | ResourcePending<T>
    | ResourceResolved<T>
    | ResourceRejected<T>;

// v2 rc.5
type ResourceReturn<T> = {
    readonly value: Promise<T>;
    readonly loading: boolean;
};
```

**Nothing changes for callers.** In v1.19 all three union members are already
`{ readonly value: Promise<T>; readonly loading: boolean }` — identical, so v2
just collapses them. `_state`, `_resolved` and `_error` were **never** on the
public v1.19 type; they live on the non-exported `ResourceReturnInternal`. If
you were reaching for `r._state` you were already off-API, and in v2 it is a
plain type error rather than a silent one.

`src/routes/canvas1/index.tsx` is the repo's only `useResource$`, consumed via
`<Resource value={…} onResolved onPending>`; `ResourceProps` is byte-identical
across the two versions. No action.

Real caveat, unrelated to shape: `ResourceCtx`, `ResourceFn`, `ResourceProps`
and `ResourceOptions` are no longer in v2's public export list, so the
`useResource$` callback parameters have no importable type name. Inline the
arrow function; don't annotate it.

**`useResource$` itself is now `@deprecated`** in rc.5:

> `@deprecated Use useComputed$ instead, which is more powerful and flexible.
useResource$ is still available for backward compatibility but it is
recommended to migrate to useComputed$ for new code and when updating existing
code.`

It still works, and v2's new async-computed engine (`AsyncSignal` in the public
list) is what `useComputed$` now builds on. This matters for the
plan's phase-8 follow-up, which proposes
`useResource$` → `routeLoader$`. Both targets are valid but they are different
things: `routeLoader$` moves the fetch to the server (and would let
`src/routes/api/map` go away), while `useComputed$` is what Qwik officially
suggests for client-side async derivation. Pick deliberately rather than by
default; the deprecation warning will fire either way until `useResource$` is
gone in v3.

---

## 4. The server-only guard, exactly

The migration plan says v2 excludes `src/**/server/**`. Right, but incomplete.
From `core/package/dist/optimizer.mjs`, a module is server-only when **either**:

```js
/\.server\.[cm]?[jt]sx?$/    // file named *.server.ts(x) — and a second regex
/\.server\.[cm]?[jt]sx?_/    // covers *.server.ts_<hash> build artefacts
/(^|\/)server(\/|$)/         // any path segment === "server", tested on the
                             // path RELATIVE to srcDir
```

Consequences the plan does not state:

- The `*.server.*` test is **independent of `srcDir`** — it applies to any file
  anywhere, including outside `src/`.
- The directory test only runs for paths under `srcDir`, which defaults to
  `<rootDir>/src`. A top-level `./server/` directory is therefore **not**
  matched. (This repo has a generated `server/` at the root — unaffected.)
- Do not try to disable the guard with `srcDir`. A non-string `srcDir` falls back
  to `"src"`, and `srcDir: ""` resolves to `rootDir`, which **widens** the
  segment test to the whole repo — the root `server/` would then match. A
  `srcDir` that does not exist is a hard error: `Qwik srcDir "…" not found.`
- `*.server.ts` is a second, file-level way to get the same protection without
  moving folders. Cheaper than the phase-3 reshuffle for a single module.

The error text, so it is recognisable in a build log (backticks stripped for
readability):

> `Server-only module cannot be imported by client code.` … `Files named
.server.* or placed under src/**/server/** are excluded from client bundles.
Move this import behind SSR-only route loaders, actions, endpoint handlers, or
expose the operation through an intentional server$ API.`

---

## 5. Names dropped from the public API

**`@qwik.dev/core/server` shrinks from 27 public exports to 16.** Dropped:
`InOrderAuto`, `InOrderDisabled`, `InOrderStreaming`, `PrefetchImplementation`,
`PrefetchResource`, `PrefetchStrategy`, `QwikLoaderOptions`,
`SerializeDocumentOptions`, `StreamingOptions`, `SymbolsToPrefetch`,
`resolveManifest`. All still exist in `dist/server.d.ts`, none are public. The
repo uses only `renderToStream` + `RenderToStreamOptions`, both fine.

Careful with `PrefetchStrategy`: a **different, unrelated** `PrefetchStrategy`
type exists in `@qwik.dev/router` (it types `<Link prefetchBundles>` /
`prefetchData` as `'commit' | 'intent' | 'visible' | 'off'`). Same name,
different meaning — not a rename.

Other core removals. Not used here, but they are the usual migration
whiplash if new code reaches for them:

- `useLexicalScope` — gone from the public surface. Still present in
  `core-internal.d.ts`, so reachable via the `@qwik.dev/core/internal` subpath,
  same as the `*Qrl` forms below. Treat it as unavailable: pass values through
  props/signals instead.
- `useErrorBoundary` — gone from the public surface.
- `h`, `createElement`, `jsxs`, and the `*Qrl` forms (`qrl`, `componentQrl`,
  `eventQrl`, `useTaskQrl`, `useVisibleTaskQrl`, `useResourceQrl`,
  `useComputedQrl`) — absent from `public.d.ts`. They are still exported from
  `core-internal.d.ts`, i.e. internal, not deleted.
- `PropFunction`, `PublicProps`, `ComputedFn`, `TaskFn`, `UseTaskOptions`,
  `EagernessOptions`, `VisibleTaskStrategy`, `DOMAttributes`, `KnownEventNames`,
  `QwikMouseEvent` / `QwikFocusEvent` / … — no longer importable. String
  literals and inline arrows replace all of them.
- `unwrapStore`, `_IMMUTABLE`, `_weakSerialize`, `SnapshotMeta`,
  `SnapshotResult` — gone.
- `RenderResult` is no longer on the core root; it is on `@qwik.dev/core/server`
  (where the repo's `renderToStream` import already lives).

New in v2 core, unused here: `Show`, `Each`, `Catch`, `Pending`, `Reveal`,
`AsyncSignal`, `ComputedSignal`, `createSerializer$`, `useSerializer$`,
`getClientManifest`.

---

## 6. Migration-plan claims confirmed against the rc.5 artifacts

Each of these was asserted in `qwik-v2-migration-plan.md` and is now checked
against the shipped files rather than inferred:

| Plan claim                                                      | Evidence                                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@qwik.dev/router` peer-pins core exactly                       | `router` `peerDependencies`: `"@qwik.dev/core": "2.0.0-rc.5"`                                                                                                                            |
| core needs Vite 8                                               | `core` peers: `vite: ">=8 <9"`, `vitest: ">=2 <5"`, `prettier: "*"`                                                                                                                      |
| `eslint-plugin-qwik` exports `qwikEslint9Plugin` unchanged      | verified in the packed `2.0.0-rc.5`; peers `eslint ^8.57 \|\| ^9 \|\| ^10`. **Note:** 2.x exists only as prerelease — `latest` on npm is still `1.20.4`, so pin the exact rc, never `^2` |
| `qwik/no-use-visible-task` is `warn` in recommended             | `"no-use-visible-task":"warn"` in the plugin bundle                                                                                                                                      |
| `TaskOptions` is `{ deferUpdates?: boolean }`, `eagerness` gone | `core-internal.d.ts`: `interface TaskOptions { deferUpdates?: boolean }`                                                                                                                 |
| `useVisibleTask$` accepts `strategy: 'document-ready'`          | `OnVisibleTaskOptions.strategy`: `intersection-observer` \| `document-ready` \| `document-idle`                                                                                          |
| `notFound` deprecated, `router` answers 404                     | `QwikRouterNodeMiddleware.notFound`: `@deprecated router handles 404 responses. Will be removed in V3.`                                                                                  |
| 10 MiB default body limit                                       | `QwikRouterNodeRequestOptions.requestBodyLimit`: "Defaults to 10 MiB"                                                                                                                    |
| `static.cacheControl` option shape unchanged                    | identical in `QwikRouterNodeRequestOptions`                                                                                                                                              |
| rollup input `@qwik-city-plan` unchanged                        | the literal is still in `router/lib`                                                                                                                                                     |
| `migrate-v2` codemod exists                                     | `core` `bin.qwik` → `qwik-cli.mjs`; `migrate-v2` is in `dist/cli.mjs`                                                                                                                    |
| `viewTransition` is opt-in                                      | `QwikRouterProps.viewTransition?: boolean`, "Default: `false`"                                                                                                                           |

One nuance to add to the plan: `QwikCityProvider`'s deprecation text points at
**`useQwikRouter()`**, and `QwikRouterProvider`'s own doc says "We recommend
using the hook instead of this component, unless you have a good reason to make
your root component reactive." `src/root.tsx` is static, so the hook is the
better pick; `QwikRouterProvider` is not wrong, just the second choice.

---

## 7. Two repo-specific things the migrator will touch

**`src/routes/index.tsx` has two `<Link>`s** (lines 9-10, to `/canvas1` and
`/test/offscreen-map`). v2's `Link` gained `prefetchBundles` / `prefetchData`
typed by the router's `PrefetchStrategy`, so the `migrate-v2` codemod may edit
that file. Review those edits per Link rather than blanket-reverting them;
prefetching on the landing page changes when bundle JS is fetched.

**`src/components/choose-username/choose-username.tsx:3` does a top-level
`import crypto from "node:crypto"`** in a client component, and uses it only
inside a `server$()` body. That survives today because `server$` strips its
function body from the client bundle, so the import is dead and gets shaken out.
If v2's optimizer stops removing it, `pnpm build.client` fails on a `node:`
builtin — loudly, at phase 7, not silently. The fix is to move the hash into a
real server endpoint or keep the `server$` body free of module-scope
identifiers. Not a reason to change the plan; just recognise the error.
