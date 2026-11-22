# Software factory

Local, serial pipeline: a GitHub issue labeled `factory` or `ready-for-agent`
goes in, a draft PR with verified tests comes out. The factory never merges.

```
issue (factory | ready-for-agent) → spec → spec review ≤3 → tests (red, hash-locked)
  → implement (worktree) → verify (cold detached checkout)
  → qa (Playwright + screenshots) → review ≤3 → retro → draft PR → human merges
```

## Files

| Path             | Role                                                            |
| ---------------- | --------------------------------------------------------------- |
| `env.sh`         | model IDs per station, timeouts. Fill this first                |
| `run.sh`         | orchestrator. All git and GitHub writes happen here             |
| `stations.sh`    | spec, spec-review, test, build, verify, qa, review, retro, ship |
| `lib.sh`         | gates, worktrees, lock, labels, logging                         |
| `ready.sh`       | human gate: validate + label + commit + push a reviewed spec    |
| `retro.sh`       | post-merge ritual and ledger stats                              |
| `retro/`         | committed history: ledger + per-issue retros                    |
| `FACTORY-OFF`    | present = hard stop. Delete to enable                           |
| `logs/issue-N/`  | transcripts, test lock, evidence (gitignored)                   |
| `state/run.lock` | single-run lock (gitignored)                                    |

Agent definitions live in `.opencode/agents/factory-*.md`. Repo conventions
for all agents live in `AGENTS.md` and `docs/agents/`.

## Two ways in

**Grill first (preferred for anything ambiguous).** Reproduce it or don't, then
run `/grill-with-docs` and `/to-spec` in the issue discussion, get the spec
reviewed, and publish it:

```sh
factory/ready.sh --issue 12
```

That validates the spec against the station contract, labels it
`ready-for-agent`, commits it, and pushes `master`. The runner builds its
worktree from `origin/master`, so **a spec that is only committed locally does
not exist as far as the pipeline is concerned.** A spec already carrying
`STATUS: READY` makes both the spec station and the spec review station skip:
your review replaces them.

**Straight issue.** Label it `factory` (or let `/to-spec` apply
`ready-for-agent` — the runner polls both) and the spec station writes the spec
from the issue body and its comments, then an independent reviewer iterates on
it before any test is written.

## Setup

1. Fill the model IDs in `factory/env.sh`. Use a different model lineage for
   `FACTORY_REVIEWER_MODEL` than `FACTORY_BUILDER_MODEL`, and for
   `FACTORY_SPEC_REVIEW_MODEL` than `FACTORY_SPEC_MODEL` — a reviewer that shares
   a lineage with the author is a rubber stamp.
2. Commit the bootstrap (agents, docs, factory) to `master` so worktrees
   contain the definitions.
3. Labels are created automatically on the first run.

## Run

```sh
factory/run.sh --issue 12 --no-ship   # dry run: no branch/PR/screenshot pushes
factory/run.sh --issue 12             # full run: pushes branch, opens draft PR
factory/run.sh                        # picks the oldest issue labeled factory
factory/run.sh --issue 12 --reset     # discard leftover branch/worktree first
```

Requirements: `gh` authenticated, repo mounted at its usual path, Node 26 and
pnpm 12 available. Installs inside worktrees use `--ignore-scripts` because
the `sharp` postinstall cannot build against Node 26; the gates do not need it.

One-time QA setup: `pnpm exec playwright install chromium` (add `--with-deps`
via sudo if the system libraries are missing). The QA station boots `pnpm dev`
headlessly on port 5199, asserts the spec's QA plan, and stores screenshots
under `factory/logs/issue-N/qa/` (gitignored). Up to four of them are pushed
to the orphan `qa-screenshots` branch (never merged into `master`) and their
raw URLs are embedded in the draft PR body — anyone can view them, `master`
history stays clean. Prune old runs with an occasional force-push of
`qa-screenshots`.

## Enable / disable

- Hard stop: keep `factory/FACTORY-OFF`. Delete it to enable.
- Soft stop: remove the `factory` label from open issues.
- Runs are manual: invoke `factory/run.sh` yourself; there is no timer.
- One run at a time: `state/run.lock` blocks overlap; stale locks from dead
  PIDs are cleared automatically.

## Safety model

- WIP 1: serial runs only, no concurrent agents on one repo.
- Worktree isolation per issue; worktrees live beside the repo as
  `vim-world-issue-N` and `vim-world-verify-N`.
- Tests are written before code, must be red, then hashed into
  `logs/issue-N/test-lock.tsv`. Any change to those files fails the run.
- The builder agent is denied edits to `*.spec.ts*` and `specs/*`.
- The engine, not the agent, runs `git add`, `git commit`, `git push`, and
  `gh`.
- The verify station re-installs and re-runs every gate, including the
  production build (`pnpm build`), in a clean detached checkout; it does not
  trust the implement station.
- The QA station drives the dev server in a real headless browser against the
  spec's QA plan; a fail feeds the builder fix loop (bounded) and re-verifies.
  Screenshots stay out of `master`; the PR body embeds them from the orphan
  `qa-screenshots` branch.
- CI (`.github/workflows/ci.yml`) repeats unit tests, lint, typecheck, and the
  build on every draft PR before the human merges.
- Draft PRs only. Human merge is the final gate.
- Failures after bounded retries post the log tail to the issue and relabel
  it `factory:escalated`.

## Failure recovery

- `factory:escalated`: read `factory/logs/issue-N/run.log`, fix or reset.
  For QA escalations the screenshots and the Playwright script
  `qa-run.ts` are under `factory/logs/issue-N/qa/`.
- `factory:needs-human`: the spec station found an ambiguous or product-level
  decision. Answer **in the issue comments** — the spec station re-reads the
  body and the whole discussion, so a reply in the thread is what it acts on.
  Remove the label, add `factory` back.
- Branch conflicts on rerun: an unpushed `factory/issue-N` branch resets
  itself automatically; a pushed branch needs `factory/run.sh --issue N --reset`.

## Retro and ledger

Every run ends with a retro: the retro agent reads the run's logs and writes
`factory/retro/issue-N.md`. On success the engine adds a line to
`factory/retro/LEDGER.md` and commits both to the factory branch, so the
history lands in `master` when you merge the PR. On escalation the retro is
posted to the issue as a comment instead; it rides the branch on the next
successful run. A retro failure never fails the run. Escalations before the
worktree exists (claim, worktree, install) skip the retro.

### Merge ritual (exact steps)

Run this after every merged factory PR:

1. Merge the draft PR on GitHub, e.g.
   `gh pr merge 12 --squash --delete-branch`.
2. Update local master so the merged retro and ledger files exist locally:
   `git checkout master && git pull`.
3. Record the outcome (about three seconds):

    ```sh
    factory/retro.sh --merged 12 --sha <merge-sha> --edits none
    ```

    Get `<merge-sha>` from step 1's output, or:
    `gh pr view 12 --json mergeCommit --jq '.mergeCommit.oid'`.
    `--edits` is what you had to fix by hand:
    `none | spec | tests | code | other`. Human edits are the strongest
    signal of factory weakness. Pass `--no-commit` to inspect the changes
    before committing them yourself.

4. Push the record: `git push`.
5. Optional: `factory/retro.sh --stats` for tag and edit counts across all
   retros.

The script refuses while a factory run is active (`state/run.lock`) and
refuses a second record for the same issue; fix those by hand. Merge factory
PRs one at a time: the ledger line of a second unmerged PR conflicts with the
first, and the resolution is simply to keep both lines.

`docs/agents/process.md` defines the failure taxonomy and the improvement
loop: retro proposals land as `factory-process` issues, and a human applies
them to prompts, scripts, or docs. Nothing in the pipeline changes
automatically.

## Automation (drafted, not enabled)

### Timer tick — "label = submit"

`factory/systemd/factory-run.{service,timer}` runs `run.sh` every 15 min as a
user timer. Safe by design: idle-exit when no issue carries `factory`,
`state/run.lock` prevents overlap, `FACTORY-OFF` is the kill switch, and the
unit refuses to start while the external drive is unmounted. Enable with:

```sh
cp factory/systemd/factory-run.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now factory-run.timer
systemctl --user list-timers factory-run.timer   # next tick
journalctl --user -u factory-run.service -f      # watch a tick
```

Missed ticks (laptop asleep) are harmless: `Persistent=true` fires once on
wake, and the queue drains one issue per tick anyway.

### Auto-file Out-of-Scope defects (design, not implemented)

The spec station names defects it excludes but has no `gh` permission (by
design). Engine-side fix in `stations.sh` after the spec station succeeds:
parse `## Non-goals` / Out-of-Scope bullets that describe a defect ("leaves",
"stretches", "erases"), file each as `gh issue create --label bug --label
needs-triage --body "Split from #<N>: <bullet>"`, and log the created numbers
to `run.log`. Cap at 3 per run to avoid spec-station ramblings flooding the
queue. Review cost: one triage pass per run, `needs-triage` marks what needs
you.

### Queue drain (optional)

One issue per tick is deliberate (WIP 1). If the queue regularly exceeds one,
swap the timer's `ExecStart` for a `while run_one_issue; do :; done` wrapper
in `run.sh --drain` mode; keep the lock so ticks still cannot overlap.
