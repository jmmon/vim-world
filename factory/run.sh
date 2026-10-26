#!/usr/bin/env bash
set -uo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$FACTORY_DIR/.." && pwd)"
PROJECTS_DIR="$(dirname "$REPO_DIR")"

source "$FACTORY_DIR/env.sh"
source "$FACTORY_DIR/lib.sh"
source "$FACTORY_DIR/stations.sh"

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

for var in FACTORY_SPEC_MODEL FACTORY_TESTER_MODEL FACTORY_BUILDER_MODEL FACTORY_QA_MODEL FACTORY_REVIEWER_MODEL; do
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
trap release_lock EXIT INT TERM

ensure_labels

cd "$REPO_DIR" || die "cannot enter repo: $REPO_DIR"
git fetch origin master --quiet || die "git fetch origin master failed"

if [[ -n "$FORCE_ISSUE" ]]; then
    ISSUE="$FORCE_ISSUE"
else
    ISSUE=$(gh issue list --label factory --state open --limit 1 --json number --jq '.[0].number' 2>/dev/null)
fi

if [[ -z "$ISSUE" || "$ISSUE" == "null" ]]; then
    log "factory idle: no open issues labeled factory"
    exit 0
fi

BRANCH="factory/issue-$ISSUE"
WT="$PROJECTS_DIR/vim-world-issue-$ISSUE"
WT_V="$PROJECTS_DIR/vim-world-verify-$ISSUE"
LOG_DIR="$FACTORY_DIR/logs/issue-$ISSUE"
mkdir -p "$LOG_DIR"
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

if ! install_deps "$WT" "$LOG_DIR/install.log"; then
    escalate "$ISSUE" "dependency install failed"
    exit 1
fi

TITLE=$(issue_title "$ISSUE") || TITLE="issue $ISSUE"
BODY=$(issue_body "$ISSUE") || BODY=""

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
    escalate "$ISSUE" "station $name failed"
    exit 1
}

stage spec station_spec "$ISSUE" "$TITLE" "$BODY"
stage tests station_tests "$ISSUE"
stage implement station_implement "$ISSUE" "$TITLE"
stage verify station_verify "$ISSUE"
stage qa station_qa "$ISSUE" "$TITLE"
stage review station_review "$ISSUE" "$TITLE"

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
        escalate "$ISSUE" "ship failed"
        exit 1
        ;;
esac
