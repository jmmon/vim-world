# Software factory

Local, serial pipeline: a GitHub issue labeled `factory` goes in, a draft PR
with verified tests comes out. The factory never merges.

```
issue (factory) → spec → tests (red, hash-locked) → implement (worktree)
  → verify (cold detached checkout) → review ≤3 → draft PR → human merges
```

## Files

| Path             | Role                                                |
| ---------------- | --------------------------------------------------- |
| `env.sh`         | model IDs per station, timeouts. Fill this first    |
| `run.sh`         | orchestrator. All git and GitHub writes happen here |
| `stations.sh`    | spec, test, build, verify, review, ship             |
| `lib.sh`         | gates, worktrees, lock, labels, logging             |
| `FACTORY-OFF`    | present = hard stop. Delete to enable               |
| `logs/issue-N/`  | transcripts, test lock, evidence (gitignored)       |
| `state/run.lock` | single-run lock (gitignored)                        |

Agent definitions live in `.opencode/agents/factory-*.md`. Repo conventions
for all agents live in `AGENTS.md` and `docs/agents/`.

## Setup

1. Fill the four model IDs in `factory/env.sh`. Use a different model lineage
   for `FACTORY_REVIEWER_MODEL` than `FACTORY_BUILDER_MODEL`.
2. Commit the bootstrap (agents, docs, factory) to `master` so worktrees
   contain the definitions.
3. Labels are created automatically on the first run.

## Run

```sh
factory/run.sh --issue 12 --no-ship   # dry run: stops before push
factory/run.sh --issue 12             # full run: pushes branch, opens draft PR
factory/run.sh                        # picks the oldest issue labeled factory
factory/run.sh --issue 12 --reset     # discard leftover branch/worktree first
```

Requirements: `gh` authenticated, repo mounted at its usual path, Node 26 and
pnpm 12 available. Installs inside worktrees use `--ignore-scripts` because
the `sharp` postinstall cannot build against Node 26; the gates do not need it.

## Enable / disable

- Hard stop: keep `factory/FACTORY-OFF`. Delete it to enable.
- Soft stop: remove the `factory` label from open issues.
- Timer: `systemctl --user stop vim-world-factory.timer`.
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
- The verify station re-installs and re-runs every gate in a clean detached
  checkout; it does not trust the implement station.
- Draft PRs only. Human merge is the final gate.
- Failures after bounded retries post the log tail to the issue and relabel
  it `factory:escalated`.

## Failure recovery

- `factory:escalated`: read `factory/logs/issue-N/run.log`, fix or reset.
- `factory:needs-human`: the spec station found an ambiguous or product-level
  decision. Answer in the issue, remove the label, add `factory` back.
- Branch conflicts on rerun: `factory/run.sh --issue N --reset`.
