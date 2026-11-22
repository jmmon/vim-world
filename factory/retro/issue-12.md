## Factory retro for #12

**AFK box silently erases Zone Hint while showing-flag stays set**

- Outcome: escalated
- Attempts: spec 0 (skipped, human-reviewed spec already READY) / tests 1 / implement 1 + fix 2 / qa 1 / review 3
- Wall minutes: 31

### Failures

- tests (attempt 1): the tester's scratch probe `src/services/draw/__probe.spec.ts` could not be deleted after use — `rm`, `mv`, `unlink`, and `git clean` were each rejected with `Permission denied: shell`; the tester repurposed the undeletable file into a green invariant guard and noted in its verdict that the reviewer/builder should delete it (`factory/logs/issue-12/tester.log`) — tags: env-fail
- review (rounds 1-3): every round requested changes on the same single finding — delete the leftover `src/services/draw/__probe.spec.ts`, which the spec's test plan does not sanction and whose assertion is fully subsumed by the AC2 disjointness test in `overlay.spec.ts`; the implementation and tests themselves were approved in all three rounds (`factory/logs/issue-12/review-1.log`, `review-2.log`, `review-3.log`) — tags: review-changes
- fix (rounds 1-2): the builder was blocked both times — shell was permission-denied for every command including `echo`, the subagent environment has no shell, and Code Mode exposes no file-delete primitive, so the reviewer's one-line `rm` fix could not be applied or the gate re-run; the engine then re-reviewed the unchanged tree (`factory/logs/issue-12/fix-1.log`, `fix-2.log`) — tags: env-fail

### Root cause

No factory agent station has shell or file-delete capability, so the tester's scratch probe that landed in `src/` could not be removed by any later station; the reviewer demanded its deletion for three straight rounds, the fix station reported `blocked` twice, and the engine re-reviewed the unchanged tree each time and escalated after round 3.

### What went well

The actual fix was clean on the first pass: implement went green on attempt 1 (131/131 tests, `factory/logs/issue-12/gate-1.log`), the cold verify reproduced it (`factory/logs/issue-12/verify.log`), QA passed on attempt 1 (`factory/logs/issue-12/qa-1.log`), and all three review rounds found spec fidelity and AC1-AC5 test coverage sound — the only blocker was the undeletable scratch file. The tester also mitigated as far as its permissions allowed, converting the probe into a passing guard and flagging it for deletion in its verdict.

### Proposal

Give the fix station a file-delete path — grant shell permission to the `factory-builder` agent in `.opencode/agents/factory-builder.md` (or add a reviewer-directed `rm` step to the engine's autofix in `factory/run.sh`) — so a one-line deletion fix cannot stall the review loop for three rounds (learned from #4, #5, #12 env-fails).

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
