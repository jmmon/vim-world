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
        local remote_ref
        if remote_ref=$(git -C "$REPO_DIR" ls-remote --heads origin "$BRANCH" 2>/dev/null); then
            if [[ -z "$remote_ref" ]]; then
                log "auto-reset unpushed branch: $BRANCH"
                git -C "$REPO_DIR" branch -D "$BRANCH" >/dev/null || return 1
            else
                log "branch already exists and is pushed: $BRANCH (use --reset to discard it)"
                return 1
            fi
        else
            log "branch already exists: $BRANCH (could not check remote; use --reset to discard it)"
            return 1
        fi
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
            timeout "$FACTORY_GATE_TIMEOUT" pnpm build.types &&
            timeout "$FACTORY_GATE_TIMEOUT" pnpm build
    ) >"$logf" 2>&1
}

run_verify_gate() {
    run_gate "$1" "$2"
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

fix_staged() {
    local dir=$1 logf=$2 line
    local -a files=()
    while IFS= read -r line; do
        case "$line" in
            src/*.ts | src/*.tsx | src/*.js | src/*.jsx)
                case "$line" in
                    *.spec.ts | *.spec.tsx) ;;
                    *) files+=("$line") ;;
                esac
                ;;
        esac
    done < <(staged_paths "$dir")
    if (( ${#files[@]} == 0 )); then
        return 0
    fi
    ( cd "$dir" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec prettier --write "${files[@]}" ) >"$logf" 2>&1 || true
    ( cd "$dir" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec eslint --fix "${files[@]}" ) >>"$logf" 2>&1 || true
    return 0
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

qa_verdict() {
    local line verdict
    line=$(last_marker "$1" "QA:")
    if [[ -z "$line" ]]; then
        printf 'fail'
        return 0
    fi
    verdict=$(printf '%s\n' "${line#QA: }" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("result", "fail"))
except Exception:
    print("fail")' 2>/dev/null)
    printf '%s' "${verdict:-fail}"
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

join_comma() {
    local out="" line
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        out+="${out:+, }$line"
    done
    printf '%s' "$out"
}

ledger_tags() {
    local f="${RUN_LOG:-/dev/null}" tags=""
    grep -q 'spec not written' "$f" 2>/dev/null && tags+="${tags:+, }spec-miss"
    grep -q 'spec missing STATUS' "$f" 2>/dev/null && tags+="${tags:+, }marker-miss"
    grep -q 'gate failed' "$f" 2>/dev/null && tags+="${tags:+, }gate-fail"
    grep -q 'prettier check failed' "$f" 2>/dev/null && tags+="${tags:+, }prettier-fail"
    grep -q 'qa failed' "$f" 2>/dev/null && tags+="${tags:+, }qa-fail"
    grep -q 'review requested changes' "$f" 2>/dev/null && tags+="${tags:+, }review-changes"
    grep -q 'dependency install failed' "$f" 2>/dev/null && tags+="${tags:+, }env-fail"
    printf '%s' "${tags:-none}"
}

ledger_attempts() {
    local f="${RUN_LOG:-/dev/null}"
    printf '%s/%s/%s/%s/%s' \
        "$(grep -c 'station: spec' "$f" 2>/dev/null)" \
        "$(grep -c 'station: tests' "$f" 2>/dev/null)" \
        "$(grep -c 'station: implement' "$f" 2>/dev/null)" \
        "$(grep -c 'station: qa' "$f" 2>/dev/null)" \
        "$(grep -c 'station: review' "$f" 2>/dev/null)"
}

ledger_minutes() {
    local f="${RUN_LOG:-/dev/null}" first last
    first=$(head -n 1 "$f" 2>/dev/null | sed -n 's/^\[\([^]]*\)\].*/\1/p')
    last=$(tail -n 1 "$f" 2>/dev/null | sed -n 's/^\[\([^]]*\)\].*/\1/p')
    if [[ -z "$first" || -z "$last" ]]; then
        printf '0'
        return 0
    fi
    printf '%s' $(( ($(date -d "$last" +%s 2>/dev/null || echo 0) - $(date -d "$first" +%s 2>/dev/null || echo 0)) / 60 ))
}

write_ledger() {
    local n=$1 outcome=$2
    local ledger="$WT/factory/retro/LEDGER.md" tmp
    mkdir -p "$WT/factory/retro"
    if [[ ! -f "$ledger" ]]; then
        {
            printf '# Ledger\n\n'
            printf 'One line per issue, upserted on rerun. Columns: date | issue | outcome | attempts (spec/tests/implement/qa/review) | minutes (wall) | tags | merged | edits\n\n'
        } >"$ledger"
    fi
    tmp=$(mktemp)
    grep -v " | #$n | " "$ledger" >"$tmp" || true
    mv "$tmp" "$ledger"
    printf '%s | #%s | %s | %s | %s | %s | - | -\n' \
        "$(date '+%F')" "$n" "$outcome" "$(ledger_attempts)" "$(ledger_minutes)" "$(ledger_tags)" >>"$ledger"
}

retro_marker() {
    # prints: <first-tag>\t<proposal-or-empty>
    local line
    line=$(last_marker "$1" "RETRO:")
    [[ -n "$line" ]] || return 0
    printf '%s\n' "${line#RETRO: }" | python3 -c 'import json, sys
try:
    d = json.load(sys.stdin)
    tags = d.get("tags") or []
    tag = tags[0] if tags and isinstance(tags[0], str) else ""
    p = d.get("proposal")
    p = p if isinstance(p, str) and p.strip() else ""
    print("%s\t%s" % (tag, p))
except Exception:
    pass' 2>/dev/null
}

collect_qa_artifacts() {
    mkdir -p "$LOG_DIR/qa"
    cp "$WT"/qa-artifacts/*.png "$LOG_DIR/qa/" 2>/dev/null || true
    cp "$WT"/qa-artifacts/*.ts "$LOG_DIR/qa/" 2>/dev/null || true
}

ensure_qa_branch() {
    local empty sha remote
    remote=$(git -C "$REPO_DIR" ls-remote --heads origin qa-screenshots 2>/dev/null) || remote=""
    if [[ -n "$remote" ]]; then
        if git -C "$REPO_DIR" fetch -f origin qa-screenshots:qa-screenshots --quiet 2>/dev/null; then
            return 0
        fi
        git -C "$REPO_DIR" show-ref --verify --quiet refs/heads/qa-screenshots && return 0
        return 1
    fi
    if git -C "$REPO_DIR" show-ref --verify --quiet refs/heads/qa-screenshots; then
        return 0
    fi
    empty=$(git -C "$REPO_DIR" hash-object -t tree /dev/null)
    sha=$(git -C "$REPO_DIR" commit-tree "$empty" -m "qa screenshots root") || return 1
    git -C "$REPO_DIR" branch qa-screenshots "$sha" || return 1
}

publish_qa_artifacts() {
    local n=$1 slug idx png name blob tree commit count=0
    ensure_qa_branch || return 0
    slug=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) || return 0
    [[ -n "$slug" ]] || return 0
    idx=$(mktemp)
    GIT_INDEX_FILE="$idx" git -C "$REPO_DIR" read-tree qa-screenshots || { rm -f "$idx"; return 0; }
    for png in "$LOG_DIR"/qa/*.png; do
        [[ -f "$png" ]] || continue
        (( count >= 4 )) && break
        if (( $(stat -c %s "$png" 2>/dev/null || echo 0) > 4000000 )); then
            continue
        fi
        name=$(basename "$png")
        blob=$(GIT_INDEX_FILE="$idx" git -C "$REPO_DIR" hash-object -w "$png") || continue
        GIT_INDEX_FILE="$idx" git -C "$REPO_DIR" update-index --add \
            --cacheinfo 100644,"$blob","factory/qa/issue-$n/$name" || continue
        count=$((count + 1))
    done
    if (( count == 0 )); then
        rm -f "$idx"
        return 0
    fi
    tree=$(GIT_INDEX_FILE="$idx" git -C "$REPO_DIR" write-tree) || { rm -f "$idx"; return 0; }
    commit=$(GIT_INDEX_FILE="$idx" git -C "$REPO_DIR" commit-tree "$tree" -p qa-screenshots -m "qa: issue #$n screenshots") || { rm -f "$idx"; return 0; }
    rm -f "$idx"
    : >"$LOG_DIR/qa-urls.tsv"
    if ! git -C "$REPO_DIR" push origin "$commit:refs/heads/qa-screenshots" >>"$LOG_DIR/qa-push.log" 2>&1; then
        log "qa screenshot push failed; evidence will use local paths"
        return 0
    fi
    count=0
    for png in "$LOG_DIR"/qa/*.png; do
        [[ -f "$png" ]] || continue
        (( count >= 4 )) && break
        name=$(basename "$png")
        if git -C "$REPO_DIR" ls-tree -r "$commit" --name-only | grep -qxF "factory/qa/issue-$n/$name"; then
            printf '%s\thttps://raw.githubusercontent.com/%s/qa-screenshots/factory/qa/issue-%s/%s\n' \
                "$name" "$slug" "$n" "$name" >>"$LOG_DIR/qa-urls.tsv"
            count=$((count + 1))
        fi
    done
    return 0
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
