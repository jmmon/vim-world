# Conventions

## TypeScript

- `strict: true`; `@typescript-eslint/no-explicit-any` is disabled but avoid
  `any` unless the surrounding code already does.
- Unused variables are errors unless prefixed with `_`.
- Use `~/foo` for imports under `src/`. Relative imports only for siblings.
- Shared simulation code must be isomorphic (browser + Node).

## Formatting

- Prettier config: 4-space indent, Tailwind class sorting plugin.
- Do not run repo-wide `pnpm fmt`: 68 files carry pre-existing debt. Format
  only the files this change touches.
- Match the local style of the file you edit. Several files use dense
  `// NOTE:` blocks to explain invariants; preserve that tone rather than
  rewriting comments.

## Naming and layout

- Directories kebab-case, files camelCase or kebab-case as neighbors use.
- Types and classes PascalCase, functions and variables camelCase.
- Specs sit beside their source. Factory specs use paths declared in the spec
  document.
- Keep module boundaries: client code does not import `src/server/*`, server
  code does not import `src/components/*`.

## Environment

- Node 26 on this machine (mise global config); pnpm 12.
- Only `pnpm-lock.yaml` is allowed. No npm or yarn lockfiles.
- Never commit `.env`, keys, or tokens.
- Build output (`dist/`, `server/`, `tmp/`) and `node_modules/` are ignored.

## Factory-owned paths

- `specs/issue-<N>.md` — written by the spec station, never edited later in
  the run.
- Test files — written by the tester station. The builder may not edit them.
- `factory/` — engine scripts and logs; agents do not modify it. Exception:
  the retro agent writes `factory/retro/issue-<N>.md`; the engine writes and
  commits `factory/retro/LEDGER.md`. See `docs/agents/process.md`.
