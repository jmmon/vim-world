## Factory retro for #11

**Canvas backing store not resized after column changes**

- Outcome: escalated
- Attempts: spec 4 (spec + spec-review, both skipped in both runs — spec was human-reviewed READY) / tests 2 (run 1 failed, run 2 ok) / implement 1 / qa 1 station with 3 attempts (2 failed, 1 passed) / review 1
- Wall minutes: 121

### Failures

- tests (run 1, 00:02:12): `tester produced no spec files` and the run ended there; the run-1 tester transcript was overwritten by the rerun, so the cause is not recorded in any surviving log (`factory/logs/issue-11/run.log`) — tags: gate-fail
- qa (attempt 1): every shell command in the QA session, including a bare `echo`, returned `Permission denied: shell`, so the harness was written but the suite never ran and no screenshots were captured; the builder's fix cycle hit the identical denial and reported blocked (`factory/logs/issue-11/qa-1.log`, `factory/logs/issue-11/fix-qa1.log`) — tags: qa-fail, env-fail
- qa (attempt 2): real product defect — with `:help` open, `:set columns=60` left zero non-zero-alpha pixels in the help-rect band and the new-rect-only strip (`band=0 strip=0`, `repaintFlag=false`); in-browser instrumentation showed Qwik's own DOM patching (`_setProperty → executeDOMRender → renderMarked`) assigning the canvas backing store from the reactive JSX bindings outside `updateCanvasDimensions`, so the guard never fired and the overlay never repainted; the same run also re-hit the #4 dev-port issue (dev SSR fetches hardcoded `localhost:5173`, so the 5199 boot needed `VITE_API_PORT=5199`) (`factory/logs/issue-11/qa-2.log`) — tags: qa-fail, env-fail
- ship (02:03:03): after QA passed and review approved, the branch and QA-screenshot pushes to `origin` (`github.com/jmmon/vim-world`) were refused by the operator's pre-push classifier (`PUSH REFUSED: remote 'origin' ... is not on the tailnet`, no `ALLOW_OUTSIDE_PUSH=1`), so the branch never shipped and the run escalated with evidence falling back to local paths (`factory/logs/issue-11/push.log`, `factory/logs/issue-11/qa-push.log`, `factory/logs/issue-11/run.log`) — tags: env-fail

### Root cause

The code work completed — QA attempt 3 passed 6/6 and review approved in round 1 — but the ship station's push to the non-tailnet GitHub remote was refused by the local pre-push classifier without `ALLOW_OUTSIDE_PUSH=1`, so the branch never shipped and the run escalated. The main rework driver inside the run was the spec's wrong premise that Qwik never reassigns the canvas JSX attributes: the reactive `width={viewport.width}`/`height={viewport.height}` bindings let Qwik's DOM patching clear the backing stores outside the guarded `updateCanvasDimensions`, so the repaint flag never fired and the help overlay vanished after a resize.

### What went well

The QA station pinned the attempt-2 failure to the exact Qwik patch stack by monkey-patching the `canvas.width` setter and `clearRect`/`fillRect` in the browser, and the builder's fix cycle resolved both findings in one pass — pinning the JSX attributes to a constant `useSignal` (making `viewport.updateCanvas` the sole backing-store writer) and deriving the dev `API_PORT` from vite's `--port` (`factory/logs/issue-11/fix-qa2.log`). The tester's red phase failed exactly on AC1/AC3 as the spec mandated (`factory/logs/issue-11/red.log`), and review approved in round 1, explicitly accepting the `canvas1.tsx` deviation from the spec's literal contract as the minimal fix preserving the spec's invariant (`factory/logs/issue-11/review-1.log`).

### Proposal

Set `ALLOW_OUTSIDE_PUSH=1` for the factory's own ship push (or add a tailnet remote for `factory/*` branches) in `factory/run.sh` and document it in `factory/README.md`, so a run that passed QA and review cannot escalate at the push classifier (learned from #11).

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
