## Factory retro for #5

**Zone Hint verb updates on zone transition; canvas text state restored**

- Outcome: pr
- Attempts: spec 6 (1 ok run 1, 2 failed run 2, 2 failed run 3, 1 ok run 4) / tests 2 / implement 4 (3 failed run 1, 1 ok run 4) / qa 1 / review 1
- Wall minutes: 64

### Failures

- implement (run 1, attempts 1-3): the changed-file prettier gate failed each time on exactly one file, `specs/issue-5.md`. The spec station's own `prettier --write` had succeeded on that file (`factory/logs/issue-5/spec-format.log`) and no station edited it afterwards, so prettier's `--write` output still failed its own `--check` — the spec's nested-bullet prose wraps to column 0 and prettier re-wraps it on every check. Nothing in the loop could fix it: the autofix only formats staged `src/*.ts` files (`factory/logs/issue-5/autofix-2.log` lists only the three src files, all unchanged) and the builder is forbidden from editing specs, so the identical failure repeated three times and escalated (`factory/logs/issue-5/prettier-2.log`, `factory/logs/issue-5/prettier-3.log`, `factory/logs/issue-5/run.log`; the run-1 record is `factory/logs/issue-5/retro-escalated.md`) — tags: prettier-fail
- spec (runs 2-3): the station exited within a second on both attempts of both runs with `Error: Agent not found: "factory-spec"`, so `specs/issue-5.md` was never written and each run escalated immediately after the worktree reset (`factory/logs/issue-5/spec-2.log`, `factory/logs/issue-5/run.log`); the identical station invocation succeeded in run 4 — tags: spec-miss, env-fail
- tester / implement / review (all runs): agent shell calls were permission-denied (`Permission denied: shell`); the tester could not run vitest to prove red, the builder could not run `pnpm build`, and the reviewer could not re-run the gate (`factory/logs/issue-5/review-1.log`, `factory/logs/issue-5/retro-escalated.md`). The engine's own red run and gate runs covered all three, so this degraded verification but caused no failure — tags: env-fail

### Root cause

Run 1 escalated because the changed-file prettier gate includes `specs/issue-5.md`, whose markdown sits in a state where prettier `--write` and `--check` disagree and no station is allowed to fix it; the two reset reruns then escalated because the `factory-spec` agent did not resolve in the freshly reset worktree, and the fourth run passed every station on its first attempt.

### What went well

Run 4 was one-pass end to end: the tester's red phase failed exactly on the 5 new tests (`factory/logs/issue-5/red.log`), implement went green on attempt 1 (125/125 tests, lint, typecheck, build in `factory/logs/issue-5/gate-1.log`), the prettier gate passed, QA passed on attempt 1 with three screenshots verified against assertions (`factory/logs/issue-5/qa-1.log`), and review approved in round 1 (`factory/logs/issue-5/review-1.log`). The test lock held across all four runs (`factory/logs/issue-5/test-lock.tsv`), and the spec's QA plan anticipated the one-frame hint lifetime with a per-frame canvas sampler instead of a timed screenshot.

### Proposal

Add a preflight step in `factory/run.sh` that probes each `factory-*` agent with a trivial `run_agent` call in the fresh worktree before the station loop, so launch failures like #4's unrecognized `--dir` flag and #5's `Agent not found: "factory-spec"` surface in seconds instead of burning two spec attempts per rerun (learned from #4, #5).

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
