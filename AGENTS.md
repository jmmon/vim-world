# vim-world

Multiplayer Vim game. Qwik City SSR frontend plus an in-memory Node websocket
server that shares one tick simulation with the browser. Keep this file short;
read the referenced docs only when the task needs them.

## Commands

| Task                 | Command                                                         |
| -------------------- | --------------------------------------------------------------- |
| Unit tests           | `pnpm test.unit`                                                |
| Lint                 | `pnpm lint`                                                     |
| Typecheck            | `pnpm build.types`                                              |
| Format changed files | `pnpm exec prettier --check <files>`                            |
| Full gate            | `pnpm test.unit && pnpm lint && pnpm build.types && pnpm build` |
| Dev server           | `pnpm dev`                                                      |
| Production build     | `pnpm build`                                                    |

Use `pnpm` for everything. Node 26 on this machine; `mise.toml` pins pnpm.

## Hard rules

- Never weaken tests to get green: no `.skip`, `.only`, `.todo`, no deleted
  tests, no loosened assertions, no swallowed errors.
- Tests live next to the code they cover as `*.spec.ts` / `*.spec.tsx`.
- `--no-verify` and force pushes are forbidden. Agents never run
  `git commit`, `git push`, or `gh`.
- Never run `git checkout HEAD -- <file>`, `git checkout -- .`, `git reset
  --hard`, or plain `git stash` on a working tree holding uncommitted work you
  need to keep — these discard changes. To inspect HEAD without touching your
  work, use a throwaway worktree: `git worktree add /tmp/head-check HEAD`
  (typecheck/build there). If you must stash, use `git stash push -u` and
  confirm it captured everything before continuing. Recovery from unreachable
  git objects is luck, not a plan.
- Prefer the `~/` path alias over deep relative imports.
- Never run repo-wide `pnpm fmt`: the repo has pre-existing formatting debt.
  Format only files you touch.
- `/server`, `/dist`, `/tmp`, `graphify-out/`, `.notes/` are generated or
  private; do not edit them.
- Never commit secrets. `.env` is local only.

## References

Read on demand, not all at once:

- `docs/agents/architecture.md` — runtime shape, data flow, module layout,
  invariants.
- `docs/agents/testing.md` — test conventions, what counts as a real test,
  determinism rules.
- `docs/agents/conventions.md` — TypeScript, formatting, naming, environment.
- `docs/agents/qwik-v2-migration-plan.md` — active Qwik 1.19 → 2.0 migration:
  phases, dependency pins, verification gates. Read before touching Qwik
  versions or the `src/server` layout.
- `docs/agents/qwik-v1-v2-delta.md` — verified v1↔v2 symbol rename table, the
  exact server-only import guard, and which removals are public-API-only. Read
  to answer "does this import survive?".
- `docs/agents/playtest-spec.md` — headless playtest harness: core API, CLI
  flags, scenario format, re-derive-`expect` workflow. Read when touching
  `pnpm playtest` scenarios or the golden suite.
- `docs/agents/map-ascii-plan.md` + `docs/agents/intro-map-rooms.md` — intro-map
  ASCII format, parser, link model, per-room layout, and open room backlog
  (gale, double-key). Read when touching the map, zones, or teaching.

## Factory

`.opencode/agents/factory-*.md` defines the automated pipeline agents and
`factory/README.md` explains the operator workflow. Factory runs use
`specs/issue-<N>.md` as the source of truth and must never modify test files
outside the tester station.

## Issue flow (GitHub tracker)

When closing a ticket, post a 3-line evidence comment via
`gh issue comment <N> --repo jmmon/vim-world -b ...`: before / after + test /
review status. Review detail stays local — never paste raw review output into
a public issue.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues in `jmmon/vim-world`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels are used verbatim (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
