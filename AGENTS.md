# vim-world

Multiplayer Vim game. Qwik City SSR frontend plus an in-memory Node websocket
server that shares one tick simulation with the browser. Keep this file short;
read the referenced docs only when the task needs them.

## Commands

| Task                 | Command                                           |
| -------------------- | ------------------------------------------------- |
| Unit tests           | `pnpm test.unit`                                  |
| Lint                 | `pnpm lint`                                       |
| Typecheck            | `pnpm build.types`                                |
| Format changed files | `pnpm exec prettier --check <files>`              |
| Full gate            | `pnpm test.unit && pnpm lint && pnpm build.types` |
| Dev server           | `pnpm dev`                                        |
| Production build     | `pnpm build`                                      |

Use `pnpm` for everything. Node 26 on this machine; `mise.toml` pins pnpm.

## Hard rules

- Never weaken tests to get green: no `.skip`, `.only`, `.todo`, no deleted
  tests, no loosened assertions, no swallowed errors.
- Tests live next to the code they cover as `*.spec.ts` / `*.spec.tsx`.
- `--no-verify` and force pushes are forbidden. Agents never run
  `git commit`, `git push`, or `gh`.
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

## Factory

`.opencode/agents/factory-*.md` defines the automated pipeline agents and
`factory/README.md` explains the operator workflow. Factory runs use
`specs/issue-<N>.md` as the source of truth and must never modify test files
outside the tester station.
