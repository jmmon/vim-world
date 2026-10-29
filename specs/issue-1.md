# Issue #1 — Add formatDuration helper in src/utils

## Goal

Add a pure duration-formatting helper `formatDuration(ms: number): string` in
`src/utils/duration.ts` that renders UI timer values as either milliseconds
(`350ms`) or seconds with one decimal place (`1.2s`), with a safe `0ms` fallback
for negative or non-finite input, covered by a colocated Vitest spec.

## Non-goals

- No minutes/hours formatting (e.g. `90s` stays `90.0s`, never `1m 30s`).
- No localization, configurable precision, or options object.
- No changes to existing `src/utils` files (`utils.ts`, `math.ts`, `color.ts`).
- No callers wired up in components or hooks; this issue only adds the helper
  and its spec.
- No server-side integration; the helper is a plain isomorphic function.

## Contracts

- New module: `src/utils/duration.ts`.
- Export exactly one function:

    ```ts
    export function formatDuration(ms: number): string;
    ```

- Behavior contract:
    - `ms < 1000` (and `ms >= 0`): return `${ms}ms` — the integer milliseconds
      with an `ms` suffix, no decimal point (e.g. `0` → `0ms`, `350` → `350ms`,
      `999` → `999ms`).
    - `ms >= 1000`: return seconds with exactly one decimal place and an `s`
      suffix, computed as `(ms / 1000)` rounded to one decimal (standard
      `toFixed(1)` rounding), e.g. `1000` → `1.0s`, `1200` → `1.2s`,
      `1499` → `1.5s`, `2000` → `2.0s`.
    - `ms < 0` (any negative value, including `-0.5` and `-Infinity`): return
      `0ms`.
    - Non-finite input (`NaN`, `Infinity`, `-Infinity`): return `0ms`.
- Invariants:
    - Pure function: no module state, no DOM or Node-only APIs, deterministic.
    - Output is always a non-empty string matching /^(\d+)ms$|^\d+\.\ds$/.
    - The seconds branch always shows one decimal digit, including `.0`
      (`2000` → `2.0s`, not `2s`).
- Edge cases and error behavior:
    - The function never throws for any `number` input; invalid values fall back
      to `0ms` rather than raising.
    - TypeScript signature takes `number`; callers passing `NaN` at runtime are
      handled by the non-finite branch, not by type tricks.

## Acceptance criteria

1. GIVEN `formatDuration(350)` WHEN called THEN it returns `"350ms"`.
2. GIVEN `formatDuration(0)` WHEN called THEN it returns `"0ms"`.
3. GIVEN `formatDuration(999)` WHEN called THEN it returns `"999ms"`.
4. GIVEN `formatDuration(1000)` WHEN called THEN it returns `"1.0s"`.
5. GIVEN `formatDuration(1200)` WHEN called THEN it returns `"1.2s"`.
6. GIVEN `formatDuration(2000)` WHEN called THEN it returns `"2.0s"`.
7. GIVEN `formatDuration(1499)` WHEN called THEN it returns `"1.5s"` (one-decimal
   rounding of `1.499`).
8. GIVEN `formatDuration(-1)` (or any negative number) WHEN called THEN it
   returns `"0ms"`.
9. GIVEN `formatDuration(NaN)`, `formatDuration(Infinity)`, and
   `formatDuration(-Infinity)` WHEN called THEN each returns `"0ms"`.
10. GIVEN the module `~/utils/duration` WHEN imported THEN it exports
    `formatDuration` as a function and the module has no side effects (importing
    it twice yields the same function reference).

## Test plan

- Spec file: `src/utils/duration.spec.ts` (colocated with the source, created
  new).
- Coverage mapping:
    - `describe("formatDuration")` with a `test` per branch:
        - milliseconds branch: `350`, `0`, `999` → criteria 1, 2, 3.
        - seconds branch: `1000`, `1200`, `2000`, `1499` → criteria 4, 5, 6, 7.
        - invalid input branch: `-1`, `NaN`, `Infinity`, `-Infinity` → criteria
          8, 9.
        - export shape: assert `typeof formatDuration === "function"` → criterion 10.
- Harness details:
    - Pure-function entry point; import `formatDuration` from `~/utils/duration`
      (the `~/` alias resolves to `src/`).
    - Import `describe`, `expect`, `test` from `vitest`.
    - No fake timers, fixtures, mocks, or network needed — the function is pure
      and synchronous.
    - Assertions compare exact string equality; no snapshots, no regex-only
      checks that could mask wrong digits.
    - 4-space indent, Prettier-formatted (ESLint ignores spec files).

## Risks

- Rounding mode for values like `1499` is not spelled out in the issue; the
  spec pins it to standard one-decimal rounding (`toFixed(1)`), which matches
  the issue's examples. If product wants truncation instead, criterion 7
  changes.
- The issue says "milliseconds" for the sub-second branch but does not state
  whether fractional milliseconds (e.g. `350.7`) should be shown; the spec
  assumes the input is an integer count of ms and renders it as-is. No test
  covers fractional sub-second input, keeping that behavior unconstrained.
- No existing callers, so there is no risk of breaking current UI; naming
  `formatDuration` in `src/utils/duration.ts` follows the issue verbatim.

STATUS: READY
