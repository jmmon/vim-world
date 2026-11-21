## Factory retro for #4

**Zone Hint dismissal leaves no residue (integer Overlay Box rects)**

- Outcome: pr
- Attempts: spec 3 (2 failed in run 1, 1 ok in run 2) / tests 1 / implement 1 / qa 1 / review 1
- Wall minutes: 40

### Failures

- spec (run 1): `opencode run` rejected the runner's `--dir` flag (`Unrecognized flag: --dir`), so the spec agent never executed; `specs/issue-4.md` was not written on either attempt and the run escalated (`factory/logs/issue-4/spec-2.log`, `factory/logs/issue-4/run.log`) — tags: spec-miss, env-fail
- qa (internal to attempt 1): the spec-mandated boot on port 5199 500s `/canvas1` because `src/server/constants.ts` hardcodes the dev `API_PORT` to 5173 and `src/services/origin.ts` builds the SSR origin from it; the harness reran the same `qa-run.ts` on a fresh strictPort server at 5173 and passed, with the deviation documented in the harness (`factory/logs/issue-4/qa-1.log`) — tags: env-fail

### Root cause

The first run escalated because the factory runner invoked the spec station with a `--dir` flag the installed `opencode` CLI does not recognize, so the CLI exited before the agent ran and no spec was written; the reset rerun then passed every station on its first attempt.

### What went well

The rerun was one-pass end to end: the tester's red phase failed exactly on the 9 new tests (`factory/logs/issue-4/red.log`), implement went green on attempt 1 (119/119 in `factory/logs/issue-4/gate-1.log`), and review approved in round 1. QA caught that the spec's 20× CPU throttle plus a bare 4 s sleep would have passed vacuously (fps stayed 4 chars on this box) and strengthened the probe to a left-edge poll at 100× throttle before reporting pass. The spec also caught a real gap the issue text glossed over — the `"00.0"` placeholder under-covers the fps box — and flagged the interpretation for the reviewer.

### Proposal

none

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
