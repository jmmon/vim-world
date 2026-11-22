#!/usr/bin/env bash
set -uo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$FACTORY_DIR/.." && pwd)"
PROJECTS_DIR="$(dirname "$REPO_DIR")"

source "$FACTORY_DIR/env.sh"
source "$FACTORY_DIR/lib.sh"
source "$FACTORY_DIR/stations.sh"

# The ship stage's whole product is a GitHub branch + draft PR, so the run's
# plan explicitly includes the outside push; without this the laptop's
# tailnet-only pre-push classifier kills ship after ~2 h of green stations
# (issue #11). The human gate stays where the factory put it: the draft PR.
export ALLOW_OUTSIDE_PUSH=1

LOCK_DIR="$FACTORY_DIR/state/run.lock"
FACTORY_LABELS=(
    "factory=fbbf24"
    "factory:wip=fb923c"
    "factory:review=22c55e"
    "factory:escalated=ef4444"
    "factory:needs-human=b91c1c"
    "factory:done=16a34a"
)

RUN_LOG=""
NO_SHIP=0
SHIP_ONLY=0
FORCE_ISSUE=""
RESET=0
BRANCH=""
WT=""
WT_V=""
LOG_DIR=""

while (( $# > 0 )); do
    case "$1" in
        --no-ship)
            NO_SHIP=1
            shift
            ;;
        --ship-only)
            SHIP_ONLY=1
            shift
            ;;
        --issue)
            FORCE_ISSUE="${2:-}"
            [[ "$FORCE_ISSUE" =~ ^[0-9]+$ ]] || die "--issue requires an issue number, got: $FORCE_ISSUE"
            shift 2
            ;;
        --reset)
            RESET=1
            shift
            ;;
        *)
            die "unknown argument: $1"
            ;;
    esac
done

if [[ -f "$FACTORY_DIR/FACTORY-OFF" ]]; then
    printf 'factory disabled: %s exists\n' "$FACTORY_DIR/FACTORY-OFF"
    exit 0
fi

# yield to the nightly skill A/B runner: it measures latency, factory load would skew it.
# oneshot units sit in "activating" while running, which is-active --quiet does not match.
if [[ "$(systemctl --user show -p ActiveState --value skill-ab.service 2>/dev/null)" == activ* ]]; then
    printf 'factory skipped: skill-ab.service is running\n'
    exit 0
fi

for var in FACTORY_SPEC_MODEL FACTORY_TESTER_MODEL FACTORY_BUILDER_MODEL FACTORY_QA_MODEL FACTORY_REVIEWER_MODEL FACTORY_SPEC_REVIEW_MODEL FACTORY_RETRO_MODEL; do
    if [[ -z "${!var:-}" ]]; then
        die "$var is empty; fill it in factory/env.sh"
    fi
done

need opencode
need gh
need pnpm
need python3
need git
need timeout

if ! gh auth status >/dev/null 2>&1; then
    die "gh is not authenticated"
fi

if ! acquire_lock; then
    exit 1
fi
trap 'release_lock; exit 1' INT TERM
trap release_lock EXIT

ensure_labels

cd "$REPO_DIR" || die "cannot enter repo: $REPO_DIR"
git fetch origin master --quiet || die "git fetch origin master failed"

if [[ -n "$FORCE_ISSUE" ]]; then
    ISSUE="$FORCE_ISSUE"
else
    ISSUE=$(next_issue)
fi

if [[ -z "$ISSUE" || "$ISSUE" == "null" ]]; then
    log "factory idle: no open issues labeled factory or ready-for-agent"
    exit 0
fi

BRANCH="factory/issue-$ISSUE"
WT="$PROJECTS_DIR/vim-world-issue-$ISSUE"
WT_V="$PROJECTS_DIR/vim-world-verify-$ISSUE"
LOG_DIR="$FACTORY_DIR/logs/issue-$ISSUE"
if [[ -d "$LOG_DIR" ]] && (( ! SHIP_ONLY )); then
    # keep the previous run's transcripts: rerun overwrote issue #11's run-1
    # tester log and its failure cause became unrecordable
    rm -rf "$LOG_DIR.prev"
    mv "$LOG_DIR" "$LOG_DIR.prev"
fi
mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR/qa-urls.tsv"
RUN_LOG="$LOG_DIR/run.log"

log "factory start: issue #$ISSUE branch $BRANCH"

if (( RESET )); then
    log "reset requested: removing worktrees and local branch"
    remove_worktree "$WT"
    remove_worktree "$WT_V"
    git -C "$REPO_DIR" branch -D "$BRANCH" >/dev/null 2>&1 || true
fi

if ! claim_issue "$ISSUE"; then
    escalate "$ISSUE" "could not claim issue"
    exit 1
fi

if ! create_run_worktree "$ISSUE"; then
    escalate "$ISSUE" "could not create worktree"
    exit 1
fi

if ! preflight_probe; then
    escalate "$ISSUE" "preflight agent probe failed (see $LOG_DIR/preflight.log)"
    exit 1
fi

if ! install_deps "$WT" "$LOG_DIR/install.log"; then
    escalate "$ISSUE" "dependency install failed"
    exit 1
fi

TITLE=$(issue_title "$ISSUE") || TITLE="issue $ISSUE"
BODY=$(issue_body "$ISSUE") || BODY=""

if (( SHIP_ONLY )); then
    # resume path for a green run that died at ship (#11): re-gate the
    # existing worktree and ship; stations are not re-run.
    [[ -d "$WT" ]] || die "--ship-only requires the prior run's worktree $WT (rerun normally without it)"
    [[ -f "$LOG_DIR/test-lock.tsv" ]] || die "--ship-only needs $LOG_DIR/test-lock.tsv from the prior run"
    check_test_lock "$WT" || die "--ship-only: test lock mismatch, rerun normally"
    run_gate "$WT" "$LOG_DIR/ship-only-gate.log" || die "--ship-only: gate failed in $WT"
    log "station: ship (ship-only resume)"
    ship "$ISSUE" "$TITLE"
    case $? in
        0|3) exit 0 ;;
        *) escalate "$ISSUE" "ship-only failed"; exit 1 ;;
    esac
fi

stage() {
    local name=$1
    shift
    log "station: $name"
    "$@"
    local rc=$?
    if (( rc == 0 )); then
        return 0
    fi
    if (( rc == 2 )); then
        log "station $name stopped for a human decision"
        remove_worktree "$WT"
        remove_worktree "$WT_V"
        exit 0
    fi
    station_retro "$ISSUE" "$TITLE" "escalated" || true
    escalate "$ISSUE" "station $name failed"
    exit 1
}

stage spec station_spec "$ISSUE" "$TITLE" "$BODY"
stage spec-review station_spec_review "$ISSUE" "$TITLE"
stage tests station_tests "$ISSUE"
stage implement station_implement "$ISSUE" "$TITLE"
stage verify station_verify "$ISSUE"
stage qa station_qa "$ISSUE" "$TITLE"
stage review station_review "$ISSUE" "$TITLE"

RETRO_OUTCOME="pr"
(( NO_SHIP )) && RETRO_OUTCOME="no-ship"
log "station: retro"
station_retro "$ISSUE" "$TITLE" "$RETRO_OUTCOME" || true

log "station: ship"
ship "$ISSUE" "$TITLE"
SHIP_RC=$?
case "$SHIP_RC" in
    0)
        log "factory complete: draft PR opened for issue #$ISSUE"
        exit 0
        ;;
    3)
        log "factory complete: no-ship mode, branch $BRANCH ready"
        exit 0
        ;;
    *)
        # the pr-outcome retro is already committed on the branch; re-running
        # it here only left an uncommitted rewrite in the worktree (#11)
        escalate "$ISSUE" "ship failed; work is green on $BRANCH"
        exit 1
        ;;
esac
