# Factory process: retro, ledger, improvement loop

The factory gains memory through three artifacts, all committed to git:

- `factory/retro/issue-<N>.md` — post-mortem per issue (retro agent writes it,
  engine commits it).
- `factory/retro/LEDGER.md` — one line per issue, the history over time
  (engine writes it).
- Issues labeled `factory-process` — improvement proposals that pass the human
  gate before anything in the pipeline changes.

Raw transcripts stay in `factory/logs/` (gitignored). The retro distills them;
the ledger aggregates them.

## Failure taxonomy

Closed list. Retro and ledger use only these tags:

| Tag              | Meaning                                          |
| ---------------- | ------------------------------------------------ |
| `spec-miss`      | spec station produced no usable spec             |
| `marker-miss`    | spec lacked the required STATUS line             |
| `gate-fail`      | test/lint/typecheck/build gate failed            |
| `prettier-fail`  | changed-file prettier check failed               |
| `qa-fail`        | Playwright QA station failed                     |
| `review-changes` | reviewer requested changes                       |
| `env-fail`       | install, toolchain, or other environment failure |

Adding a tag means editing this file first. Grep-ability beats expressiveness.

## Ownership

| Artifact                     | Writer                                    | When                                    |
| ---------------------------- | ----------------------------------------- | --------------------------------------- |
| `factory/retro/issue-<N>.md` | retro agent                               | every successful run, every escalation  |
| `factory/retro/LEDGER.md`    | engine (deterministic)                    | successful runs only (rides the branch) |
| issue comment with retro     | engine                                    | escalated runs (no branch ships)        |
| `factory-process` issue      | engine (from the agent's proposal marker) | on repeat signals only                  |

The engine, never the agent, runs `git add`, `git commit`, and `gh`.

## Retro file template

```markdown
## Factory retro for #<N>

**<title>**

- Outcome: pr | no-ship | escalated
- Attempts: spec / tests / implement / qa / review
- Wall minutes: N

### Failures

- <station>: <what failed> — tags: <tag>

### Root cause

One or two sentences. Factual, no blame.

### What went well

Optional. Only when something did.

### Proposal

One sentence process fix, or "none".

### Merge outcome

Filled later by `factory/retro.sh --merged`.

- merged: <sha>
- human edits: none | spec | tests | code | other
```

## Ledger format

One line per issue, upserted on rerun:

```
date | issue | outcome | attempts | minutes | tags | merged | edits
```

- `outcome`: `pr`, `no-ship`, or `escalated` (escalated lines land on the
  eventual successful rerun's branch).
- `attempts`: station invocation counts across all runs of the issue,
  `spec/tests/implement/qa/review`.
- `minutes`: wall clock from first run start to last completion; includes
  human pauses between reruns.
- `tags`: engine-derived from `run.log` by grep (deterministic). The retro
  agent may use the same tags in its file but cannot change the ledger.
- `merged` / `edits`: empty (`-`) until the human records the merge.

## Merge ritual

Exact steps; see `factory/README.md` for the full walkthrough:

1. Merge the draft PR.
2. `git checkout master && git pull` so the retro and ledger files exist
   locally.
3. `factory/retro.sh --merged <issue> --sha <merge-sha> --edits <kind>`
   — `kind` is `none | spec | tests | code | other`, what you had to fix
   by hand. Human edits are the sharpest signal of factory weakness. The
   command updates the ledger line and appends a Merge record to the retro
   file, then commits both.
4. `git push`.
5. Optional: `factory/retro.sh --stats`.

Merge factory PRs one at a time. The ledger line for a second unmerged PR
conflicts with the first; resolution is trivial: keep both lines.

## Improvement loop

1. `factory/retro.sh --stats` prints tag and edit counts across
   `factory/retro/`. Run it whenever you want the aggregate view.
2. The retro agent proposes a process fix in its `RETRO:` marker only when its
   root-cause tag already appears in at least two retro files (including this
   one) and the fix is concrete. The engine posts it as an issue labeled
   `factory-process`, skipping when an open proposal for that tag exists.
3. A human reviews the proposal, then either applies the change (prompt,
   script, or doc edit) through normal review, or closes the issue with a
   reason. Nothing edits prompts or scripts automatically.
4. The applied change should name the issues that motivated it
   (`learned from #N, #M`) so `git log` keeps the why.

Until ten or more retro files exist, trust manual `--stats` reads over the
agent's repeat-signal heuristic.
