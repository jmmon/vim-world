#!/usr/bin/env bash

log() {
    local line
    line="[$(date '+%F %T')] $*"
    printf '%s\n' "$line"
    if [[ -n "${RUN_LOG:-}" ]]; then
        printf '%s\n' "$line" >>"$RUN_LOG"
    fi
}

die() {
    log "FATAL: $*"
    exit 1
}

need() {
    command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"
}

acquire_lock() {
    mkdir -p "$FACTORY_DIR/state"
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        printf '%s\n' "$$" >"$LOCK_DIR/pid"
        return 0
    fi
    local other=""
    if [[ -f "$LOCK_DIR/pid" ]]; then
        other=$(cat "$LOCK_DIR/pid")
    fi
    if [[ -n "$other" ]] && kill -0 "$other" 2>/dev/null; then
        log "another factory run is active (pid $other)"
        return 1
    fi
    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR" || return 1
    printf '%s\n' "$$" >"$LOCK_DIR/pid"
}

release_lock() {
    if [[ -d "$LOCK_DIR" ]]; then
        rm -rf "$LOCK_DIR"
    fi
}

ensure_labels() {
    local entry name color
    for entry in "${FACTORY_LABELS[@]}"; do
        name=${entry%%=*}
        color=${entry#*=}
        gh label create "$name" --color "$color" >/dev/null 2>&1 || true
    done
}

issue_title() {
    gh issue view "$1" --json title --jq '.title'
}

issue_body() {
    gh issue view "$1" --json body --jq '.body'
}

claim_issue() {
    local n=$1
    gh issue edit "$n" --remove-label factory --add-label factory:wip >/dev/null || return 1
    gh issue comment "$n" --body "Factory run claimed this issue at $(date -Is). Branch: \`$BRANCH\`." >/dev/null || return 1
}

remove_worktree() {
    local dir=$1
    if [[ -d "$dir" ]]; then
        git -C "$REPO_DIR" worktree remove --force "$dir" >/dev/null 2>&1 || rm -rf "$dir"
    fi
    git -C "$REPO_DIR" worktree prune >/dev/null 2>&1 || true
}

create_run_worktree() {
    remove_worktree "$WT"
    if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
        log "branch already exists: $BRANCH (use --reset to discard it)"
        return 1
    fi
    git -C "$REPO_DIR" worktree add "$WT" -b "$BRANCH" origin/master >/dev/null || return 1
    mkdir -p "$WT/specs"
}

create_verify_worktree() {
    remove_worktree "$WT_V"
    git -C "$REPO_DIR" worktree add --detach "$WT_V" "$BRANCH" >/dev/null || return 1
}

install_deps() {
    local dir=$1 logf=$2
    ( cd "$dir" && timeout 600 pnpm install --frozen-lockfile --ignore-scripts ) >"$logf" 2>&1
}

run_gate() {
    local dir=$1 logf=$2
    (
        cd "$dir" &&
            timeout "$FACTORY_GATE_TIMEOUT" pnpm test.unit &&
            timeout "$FACTORY_GATE_TIMEOUT" pnpm lint &&
            timeout "$FACTORY_GATE_TIMEOUT" pnpm build.types
    ) >"$logf" 2>&1
}

staged_paths() {
    git -C "$1" diff --cached --name-only origin/master
}

branch_paths() {
    git -C "$1" diff --name-only origin/master...HEAD
}

check_prettier() {
    local dir=$1 mode=$2 logf=$3
    local -a files=()
    local line
    if [[ "$mode" == staged ]]; then
        while IFS= read -r line; do
            case "$line" in
                *.ts | *.tsx | *.js | *.jsx | *.json | *.css | *.md) files+=("$line") ;;
            esac
        done < <(staged_paths "$dir")
    else
        while IFS= read -r line; do
            case "$line" in
                *.ts | *.tsx | *.js | *.jsx | *.json | *.css | *.md) files+=("$line") ;;
            esac
        done < <(branch_paths "$dir")
    fi
    if (( ${#files[@]} == 0 )); then
        return 0
    fi
    ( cd "$dir" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec prettier --check "${files[@]}" ) >"$logf" 2>&1
}

write_test_lock() {
    local f
    : >"$LOG_DIR/test-lock.tsv"
    for f in "$@"; do
        printf '%s\t%s\n' "$(sha256sum "$WT/$f" | cut -d' ' -f1)" "$f" >>"$LOG_DIR/test-lock.tsv"
    done
}

check_test_lock() {
    local dir=$1 hash f actual
    if [[ ! -f "$LOG_DIR/test-lock.tsv" ]]; then
        log "missing test lock"
        return 1
    fi
    while IFS=$'\t' read -r hash f; do
        if [[ -z "$hash" ]]; then
            continue
        fi
        if [[ ! -f "$dir/$f" ]]; then
            log "locked test missing: $f"
            return 1
        fi
        actual=$(sha256sum "$dir/$f" | cut -d' ' -f1)
        if [[ "$actual" != "$hash" ]]; then
            log "locked test modified: $f"
            return 1
        fi
    done <"$LOG_DIR/test-lock.tsv"
}

run_agent() {
    local agent=$1 model=$2 dir=$3 logf=$4 prompt=$5
    timeout "$FACTORY_AGENT_TIMEOUT" \
        opencode run --agent "$agent" --model "$model" --auto --dir "$dir" "$prompt" \
        >"$logf" 2>&1
}

last_marker() {
    local file=$1 marker=$2
    if [[ ! -f "$file" ]]; then
        return 0
    fi
    grep -o "${marker}.*" "$file" | tail -1
}

review_verdict() {
    local line verdict
    line=$(last_marker "$1" "REVIEW:")
    if [[ -z "$line" ]]; then
        printf 'changes'
        return 0
    fi
    verdict=$(printf '%s\n' "${line#REVIEW: }" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("verdict", "changes"))
except Exception:
    print("changes")' 2>/dev/null)
    printf '%s' "${verdict:-changes}"
}

latest_review_log() {
    local f
    f=$(find "$LOG_DIR" -maxdepth 1 -name 'review-*.log' -type f 2>/dev/null | sort -V | tail -1)
    printf '%s' "$f"
}

sanitize_stream() {
    sed -e "s|${PROJECTS_DIR}|[projects]|g" \
        -e "s|${HOME}|[home]|g" \
        -e "s|${WT_V}|[worktree]|g" \
        -e "s|${WT}|[worktree]|g"
}

commit_branch() {
    local n=$1 title=$2
    git -C "$WT" add -A >/dev/null 2>&1 || return 1
    if ! git -C "$WT" diff --cached --quiet; then
        git -C "$WT" commit -q -m "feat(factory): $title (#$n)" || return 1
    fi
}

escalate() {
    local n=$1 reason=$2 body
    log "escalating issue #$n: $reason"
    body=$(tail -n 60 "${RUN_LOG:-/dev/null}" 2>/dev/null | sanitize_stream)
    gh issue comment "$n" --body "Factory run escalated: $reason

\`\`\`
$body
\`\`\`

Local logs: \`factory/logs/issue-$n/\`." >/dev/null 2>&1 || true
    gh issue edit "$n" --remove-label factory:wip --add-label factory:escalated >/dev/null 2>&1 || true
}
