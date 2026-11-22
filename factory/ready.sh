#!/usr/bin/env bash
# Human gate: publish a reviewed spec so the factory runner can consume it.
#
# The runner builds its worktree from origin/master and skips the spec station
# when specs/issue-N.md already carries STATUS: READY. So a spec that is only
# committed locally, or that lacks the marker, is invisible to the pipeline.
# This script checks the contract, sets the labels, commits, and pushes.
set -euo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$FACTORY_DIR/.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  factory/ready.sh --issue <n> [--no-commit] [--no-push]

Marks a human-reviewed spec as ready for the factory runner:

  1. checks specs/issue-<n>.md exists, ends with STATUS: READY, and carries the
     sections the downstream stations require (a /to-spec issue body is not
     enough on its own: the tester station needs a Test plan with exact paths)
  2. labels the issue ready-for-agent and clears needs-triage / needs-info
  3. commits the spec file and pushes master so the runner's worktree sees it

  --no-commit  validate and label only, leave the commit to you
  --no-push    commit but do not push (the runner will NOT see it yet)
EOF
}

die() {
    printf 'ready.sh: %s\n' "$*" >&2
    exit 1
}

ISSUE=""
NO_COMMIT=0
NO_PUSH=0

while (( $# > 0 )); do
    case "$1" in
        --issue)
            ISSUE="${2:-}"
            shift 2
            ;;
        --no-commit)
            NO_COMMIT=1
            shift
            ;;
        --no-push)
            NO_PUSH=1
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            die "unknown argument: $1"
            ;;
    esac
done

[[ "$ISSUE" =~ ^[0-9]+$ ]] || {
    usage >&2
    die "--issue requires an issue number"
}

cd "$REPO_DIR" || die "cannot enter repo: $REPO_DIR"

SPEC="specs/issue-$ISSUE.md"
[[ -f "$SPEC" ]] || die "no spec at $SPEC — write or /to-spec it first"

# Section contract from .opencode/agents/factory-spec.md. station_tests is told
# to write "exactly the paths listed" in the Test plan, and station_qa boots
# from the QA plan, so a spec missing either escalates mid-run.
missing=()
for section in '## Goal' '## Non-goals' '## Contracts' '## Acceptance criteria' '## Test plan' '## QA plan'; do
    grep -q "^$section" "$SPEC" || missing+=("$section")
done
if (( ${#missing[@]} > 0 )); then
    printf 'ready.sh: %s is missing required sections:\n' "$SPEC" >&2
    printf '  %s\n' "${missing[@]}" >&2
    die "the runner would fail downstream; add them or let the spec station write them"
fi

grep -q '^STATUS: READY' "$SPEC" ||
    die "$SPEC does not end with STATUS: READY — it is not a reviewed spec yet"
grep -q '^STATUS: NEEDS-HUMAN' "$SPEC" &&
    die "$SPEC says NEEDS-HUMAN; resolve the open decision before publishing"

# A Test plan with no file paths gives the tester nothing to write.
awk '/^## Test plan/{p=1;next} /^## /{p=0} p' "$SPEC" |
    grep -Eq '\.(spec\.ts|spec\.tsx)`?' ||
    die "the Test plan in $SPEC names no *.spec.ts path; the tester station cannot act on it"

if [[ -d "$FACTORY_DIR/state/run.lock" ]]; then
    die "a factory run is active; wait for it to finish"
fi

branch=$(git rev-parse --abbrev-ref HEAD)
[[ "$branch" == "master" ]] || die "publish from master, current branch is $branch"

git fetch origin master --quiet || die "git fetch origin master failed"
git merge-base --is-ancestor origin/master master ||
    die "local master is behind or diverged from origin/master; reconcile first"

if (( NO_COMMIT )); then
    printf 'spec #%s validates; labels not touched (--no-commit)\n' "$ISSUE"
    exit 0
fi

if ! git ls-files --error-unmatch "$SPEC" >/dev/null 2>&1 || ! git diff --quiet HEAD -- "$SPEC"; then
    git add -- "$SPEC" &&
        git commit -m "docs(spec): reviewed spec for issue #$ISSUE" -- "$SPEC"
else
    printf 'ready.sh: %s is already committed and unchanged\n' "$SPEC" >&2
fi

if (( NO_PUSH )); then
    printf 'committed, not pushed: the runner will not see %s until you push master\n' "$SPEC"
    exit 0
fi

# Only the spec commit may ship. Anything else on master is unrelated work the
# operator has not asked to publish.
extra=$(git log --oneline origin/master..master -- . ":(exclude)$SPEC")
if [[ -n "$extra" ]]; then
    printf 'ready.sh: refusing to push; master also carries commits unrelated to the spec:\n' >&2
    printf '  %s\n' "$extra" >&2
    die "push them deliberately, or rebase the spec commit on top of origin/master"
fi

git push origin master ||
    die "push refused (the pre-push hook blocks outside remotes unless ALLOW_OUTSIDE_PUSH=1 is set for this push)"

# The runner only reads origin, but the tailnet mirror is kept in sync by habit.
if git remote get-url gitea >/dev/null 2>&1; then
    git push gitea master || printf 'ready.sh: gitea mirror push failed; origin is what matters\n' >&2
fi

# Labels last: the runner polls ready-for-agent, so a push that failed above
# must not leave a queued issue pointing at a spec that is not on the remote.
gh issue edit "$ISSUE" --remove-label needs-triage --remove-label needs-info \
    --add-label ready-for-agent >/dev/null ||
    die "spec is on origin/master but labeling failed; label #$ISSUE by hand"

printf 'issue #%s ready: spec on origin/master, labeled ready-for-agent\n' "$ISSUE"
