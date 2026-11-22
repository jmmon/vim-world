## Factory retro for #11

**Canvas backing store not resized after column changes**

- Outcome: pr
- Attempts: spec 0 (skipped both runs — spec was human-reviewed READY) / tests 2 (run 1 failed, run 2 ok) / implement 1 / qa 3 (2 failed, 1 passed) / review 1
- Wall minutes: 121

### Failures

- tests (run 1): `tester produced no spec files` and the run ended there; the run-1 tester transcript was overwritten by the rerun, so the cause is not recorded in any surviving log (`factory/logs/issue-11/run.log`) — tags: gate-fail
- qa (attempt 1): every shell command in the QA session, including a bare `echo`, returned `Permission denied: shell`, so the harness was written but the suite never ran and no screenshots were captured; the builder's fix cycle hit the identical denial and reported blocked (`factory/logs/issue-11/qa-1.log`, `factory/logs/issue-11/fix-qa1.log`) — tags: qa-fail, env-fail
- qa (attempt 2): real product defect — with `:help` open, `:set columns=60` left zero non-zero-alpha pixels in the help-rect band and the new-rect-only strip (`band=0 strip=0`, `repaintFlag=false`); in-browser instrumentation showed Qwik's own DOM patching (`_setProperty → executeDOMRender → renderMarked`) assigning the canvas backing store from the reactive JSX bindings outside `updateCanvasDimensions`, so the guard never fired and the overlay never repainted; the same run also re-hit the #4 dev-port issue (dev SSR fetches hardcoded `localhost:5173`, so the 5199 boot needed `VITE_API_PORT=5199`) (`factory/logs/issue-11/qa-2.log`) — tags: qa-fail, env-fail

### Root cause

The spec's premise that Qwik never reassigns the canvas JSX attributes was wrong: the reactive `width={viewport.width}`/`height={viewport.height}` bindings let Qwik's DOM patching clear the backing stores outside the guarded `updateCanvasDimensions`, so the repaint flag never fired and the help overlay vanished after a resize. The fix cycle pinned the JSX attributes to a constant `useSignal` (making `viewport.updateCanvas` the sole backing-store writer) and derived the dev `API_PORT` from vite's `--port`; QA attempt 3 then passed 6/6.

### What went well

The QA station pinned the attempt-2 failure to the exact Qwik patch stack by monkey-patching the `canvas.width` setter and `clearRect`/`fillRect` in the browser, and the builder's fix cycle resolved both findings in one pass (`factory/logs/issue-11/fix-qa2.log`). The tester's red phase failed exactly on AC1/AC3 as the spec mandated (`factory/logs/issue-11/red.log`), and review approved in round 1, explicitly accepting the `canvas1.tsx` deviation from the spec's literal contract as the minimal fix preserving the spec's invariant (`factory/logs/issue-11/review-1.log`).

### Proposal

Grant the factory agent sessions shell permission for the QA/e2e commands in `.opencode/agents/factory-*.md` so a QA attempt is not burned on blanket `Permission denied: shell` denials, which degraded #5 and consumed all of #11's QA attempt 1 (learned from #5, #11).

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
