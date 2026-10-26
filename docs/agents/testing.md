# Testing

## Runner

- `pnpm test.unit` → `vitest run`.
- `pnpm build` runs a full client plus SSR build (about 4s warm); the gate
  includes it so bundling and serialization breakage fails too.
- Specs are colocated: `foo.ts` ↔ `foo.spec.ts`, `foo.tsx` ↔ `foo.spec.tsx`.
- Import `describe`, `expect`, `test` from `vitest`.
- `~/` resolves to `src/`.
- ESLint ignores spec files, so keep them tidy yourself: 4-space indent,
  Prettier formatting.

## What counts as a real test

- Asserts observable behavior, not implementation details.
- Would fail if the behavior broke. No tautologies, no assertion-free tests.
- No snapshot of an entire object to dodge thinking about fields.
- Deterministic: no real network, no wall-clock sleeps, no dependence on test
  order. Use fake timers for tick or timeout logic.
- Prefer pure functions and small harnesses (see
  `src/simulation/shared/loop/helpers.spec.ts` and
  `src/server/wss/handleAfkDisconnect.spec.ts`).

## Forbidden

- `.skip`, `.only`, `.todo`, commented-out assertions.
- Weakening an assertion so an implementation can pass.
- Deleting a failing test instead of fixing the code.
- Catching and ignoring errors inside a test.

## Green

Green means `pnpm test.unit`, `pnpm lint`, `pnpm build.types`, and
`pnpm build` all exit 0
and the changed files pass `pnpm exec prettier --check <files>`. Nothing less
counts.
