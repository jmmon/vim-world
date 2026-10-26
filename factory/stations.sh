#!/usr/bin/env bash

station_spec() {
    local n=$1 title=$2 body=$3 attempt prompt spec_file
    spec_file="$WT/specs/issue-$n.md"
    for attempt in 1 2; do
        if (( attempt == 1 )); then
            prompt=$(printf 'Factory spec station. Issue #%s.\n\nTitle: %s\n\nBody:\n%s\n\nWrite specs/issue-%s.md exactly as your instructions require. End the file with STATUS: READY or STATUS: NEEDS-HUMAN.\n' "$n" "$title" "$body" "$n")
        else
            prompt=$(printf 'The spec file specs/issue-%s.md exists but is missing the required final STATUS line. Add the single line STATUS: READY at the end, or STATUS: NEEDS-HUMAN with a one-sentence reason if a product decision is missing. Do not rewrite the spec.\n' "$n")
        fi
        run_agent factory-spec "$FACTORY_SPEC_MODEL" "$WT" "$LOG_DIR/spec-$attempt.log" "$prompt" || true
        if [[ ! -f "$spec_file" ]]; then
            log "spec not written (attempt $attempt): specs/issue-$n.md"
            continue
        fi
        if grep -q 'STATUS: NEEDS-HUMAN' "$spec_file"; then
            log "spec needs a human decision"
            gh issue comment "$n" --body "Factory stopped at the spec station. A human decision is needed:

\`\`\`
$(head -n 40 "$spec_file" | sanitize_stream)
\`\`\`

The issue was relabeled \`factory:needs-human\`." >/dev/null 2>&1 || true
            gh issue edit "$n" --remove-label factory:wip --add-label factory:needs-human >/dev/null 2>&1 || true
            return 2
        fi
        if grep -q 'STATUS: READY' "$spec_file"; then
            ( cd "$WT" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec prettier --write "specs/issue-$n.md" ) >>"$LOG_DIR/spec-format.log" 2>&1 || true
            git -C "$WT" add "specs/issue-$n.md" >/dev/null 2>&1 || return 1
            return 0
        fi
        log "spec missing STATUS marker (attempt $attempt)"
    done
    return 1
}

station_tests() {
    local n=$1 prompt f
    local -a specs=()
    prompt=$(printf 'Factory test station. Issue #%s.\n\nSpec: specs/issue-%s.md\n\nWrite the tests declared in the spec Test plan section at exactly the paths listed there. Run them and confirm they are red. Do not touch implementation files. End with TESTS: {"files": [...], "red": true}.\n' "$n" "$n")
    run_agent factory-tester "$FACTORY_TESTER_MODEL" "$WT" "$LOG_DIR/tester.log" "$prompt" || true
    git -C "$WT" add -A >/dev/null 2>&1 || return 1
    while IFS= read -r f; do
        case "$f" in
            *.spec.ts | *.spec.tsx) specs+=("$f") ;;
        esac
    done < <(staged_paths "$WT")
    if (( ${#specs[@]} == 0 )); then
        log "tester produced no spec files"
        return 1
    fi
    printf '%s\n' "${specs[@]}" >"$LOG_DIR/spec-files.txt"
    if ( cd "$WT" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec prettier --write "${specs[@]}" ) >"$LOG_DIR/tester-format.log" 2>&1; then
        git -C "$WT" add -A >/dev/null 2>&1 || return 1
    else
        log "prettier could not format test files; continuing"
    fi
    if ( cd "$WT" && timeout "$FACTORY_GATE_TIMEOUT" pnpm exec vitest run "${specs[@]}" ) >"$LOG_DIR/red.log" 2>&1; then
        log "tests are green before implementation; expected red"
        return 1
    fi
    write_test_lock "${specs[@]}" || return 1
    return 0
}

station_implement() {
    local n=$1 title=$2 attempt ctx prompt spec_files
    spec_files=$(tr '\n' ' ' <"$LOG_DIR/spec-files.txt")
    for attempt in 1 2 3; do
        log "implement attempt $attempt"
        ctx=""
        if (( attempt == 1 )); then
            ctx=$(tail -n 120 "$LOG_DIR/red.log" 2>/dev/null)
        else
            ctx=$(tail -n 160 "$LOG_DIR/gate-$((attempt - 1)).log" 2>/dev/null)
        fi
        prompt=$(printf 'Factory build station. Issue #%s.\n\nSpec: specs/issue-%s.md\nTest files: %s\n\nCurrent failure output:\n%s\n\nImplement the smallest change that makes the gate green. Do not edit specs or test files. End with BUILD: {"result": "green"} or BUILD: {"result": "blocked", "reason": "..."}.\n' "$n" "$n" "$spec_files" "$ctx")
        run_agent factory-builder "$FACTORY_BUILDER_MODEL" "$WT" "$LOG_DIR/implement-$attempt.log" "$prompt" || true
        check_test_lock "$WT" || return 1
        git -C "$WT" add -A >/dev/null 2>&1 || return 1
        fix_staged "$WT" "$LOG_DIR/autofix-$attempt.log"
        git -C "$WT" add -A >/dev/null 2>&1 || return 1
        if run_gate "$WT" "$LOG_DIR/gate-$attempt.log"; then
            if check_prettier "$WT" staged "$LOG_DIR/prettier-$attempt.log"; then
                commit_branch "$n" "$title" || return 1
                return 0
            fi
            log "prettier check failed on changed files"
        else
            log "gate failed on attempt $attempt"
        fi
    done
    return 1
}

fix_from_findings() {
    local n=$1 title=$2 findings=$3 round=$4 prompt
    prompt=$(printf 'Factory fix cycle %s for issue #%s.\n\nSpec: specs/issue-%s.md\nReviewer findings JSON:\n%s\n\nAddress every blocker without editing specs or test files. End with BUILD: {"result": "green"} or BUILD: {"result": "blocked", "reason": "..."}.\n' "$round" "$n" "$n" "$findings")
    run_agent factory-builder "$FACTORY_BUILDER_MODEL" "$WT" "$LOG_DIR/fix-$round.log" "$prompt" || true
    check_test_lock "$WT" || return 1
    git -C "$WT" add -A >/dev/null 2>&1 || return 1
    fix_staged "$WT" "$LOG_DIR/fix-autofix-$round.log"
    git -C "$WT" add -A >/dev/null 2>&1 || return 1
    run_gate "$WT" "$LOG_DIR/fix-gate-$round.log" || return 1
    check_prettier "$WT" staged "$LOG_DIR/fix-prettier-$round.log" || return 1
    commit_branch "$n" "$title" || return 1
    return 0
}

station_verify() {
    local n=$1
    log "cold verify in detached checkout"
    create_verify_worktree || return 1
    if ! install_deps "$WT_V" "$LOG_DIR/verify-install.log"; then
        remove_worktree "$WT_V"
        return 1
    fi
    if ! check_test_lock "$WT_V"; then
        remove_worktree "$WT_V"
        return 1
    fi
    if ! run_verify_gate "$WT_V" "$LOG_DIR/verify.log"; then
        remove_worktree "$WT_V"
        return 1
    fi
    if ! check_prettier "$WT_V" branch "$LOG_DIR/verify-prettier.log"; then
        remove_worktree "$WT_V"
        return 1
    fi
    remove_worktree "$WT_V"
    return 0
}

station_qa() {
    local n=$1 title=$2 attempt prompt verdict findings
    mkdir -p "$WT/qa-artifacts"
    for attempt in 1 2 3; do
        log "qa attempt $attempt"
        prompt=$(printf 'Factory QA station. Issue #%s.\n\nSpec: specs/issue-%s.md\n\nFollow the spec QA plan exactly. Write a throwaway Playwright config and test under qa-artifacts/ (name it qa-artifacts/qa-run.ts and set testMatch to it so no other runner collects it). The config must boot `pnpm dev --port 5199 --strictPort` at http://localhost:5199 with reuseExistingServer false (no `--` separator: pnpm forwards it literally and vite ignores the flags; 5173 may be a stale checkout). Drive every step of the QA plan, assert the expected states in code, and save at most 6 screenshots as qa-artifacts/<step>.png. Read the source to learn login and movement flows; edit nothing outside qa-artifacts/. Run `pnpm exec playwright test qa-artifacts/qa-run.ts`, then read your own screenshots and confirm they match the assertions. Your final line must be exactly:\nQA: {"result": "pass", "findings": []}\nor\nQA: {"result": "fail", "findings": [{"file": "<path>", "issue": "<what is wrong>", "fix": "<concrete fix>"}]}\n' "$n" "$n")
        run_agent factory-qa "$FACTORY_QA_MODEL" "$WT" "$LOG_DIR/qa-$attempt.log" "$prompt" || true
        if [[ -z "$(last_marker "$LOG_DIR/qa-$attempt.log" "QA:")" ]]; then
            log "qa produced no verdict (attempt $attempt); retrying"
            continue
        fi
        verdict=$(qa_verdict "$LOG_DIR/qa-$attempt.log")
        if [[ "$verdict" == "pass" ]]; then
            log "qa passed on attempt $attempt"
            collect_qa_artifacts
            return 0
        fi
        log "qa failed on attempt $attempt"
        if (( attempt == 3 )); then
            collect_qa_artifacts
            return 1
        fi
        findings=$(last_marker "$LOG_DIR/qa-$attempt.log" "QA:")
        fix_from_findings "$n" "$title" "$findings" "qa$attempt" || return 1
        station_verify "$n" || return 1
    done
    return 1
}

station_review() {
    local n=$1 title=$2 round=1 findings prompt qa_json qa_log
    qa_log=$(find "$LOG_DIR" -maxdepth 1 -name 'qa-[0-9]*.log' -type f 2>/dev/null | sort -V | tail -1)
    qa_json=$(last_marker "$qa_log" "QA:")
    [[ -n "$qa_json" ]] || qa_json="QA: not run"
    while (( round <= 3 )); do
        log "review round $round"
        prompt=$(printf 'Factory review station. Issue #%s.\n\nSpec: specs/issue-%s.md\nBranch: %s\nQA station result (screenshots at factory/logs/issue-%s/qa/, local only):\n%s\n\nReview the diff against origin/master. End with REVIEW: {"verdict": ...} as specified.\n' "$n" "$n" "$BRANCH" "$n" "$qa_json")
        run_agent factory-reviewer "$FACTORY_REVIEWER_MODEL" "$WT" "$LOG_DIR/review-$round.log" "$prompt" || true
        if [[ -z "$(last_marker "$LOG_DIR/review-$round.log" "REVIEW:")" ]]; then
            log "review round $round produced no verdict; retrying"
            round=$((round + 1))
            continue
        fi
        if [[ "$(review_verdict "$LOG_DIR/review-$round.log")" == "approve" ]]; then
            log "review approved"
            return 0
        fi
        log "review requested changes on round $round"
        if (( round >= 3 )); then
            return 1
        fi
        findings=$(last_marker "$LOG_DIR/review-$round.log" "REVIEW:")
        fix_from_findings "$n" "$title" "$findings" "$round" || return 1
        station_verify "$n" || return 1
        round=$((round + 1))
    done
    return 1
}

write_evidence() {
    local n=$1 title=$2 spec_files review_json
    spec_files=$(join_comma <"$LOG_DIR/spec-files.txt")
    review_json=$(last_marker "$(latest_review_log)" "REVIEW:" | sed 's/^REVIEW: //')
    {
        printf '## Factory run for #%s\n\n' "$n"
        printf '**%s**\n\n' "$title"
        printf 'Spec: `specs/issue-%s.md`\n\n' "$n"
        printf 'Tests: %s\n\n' "$spec_files"
        printf '### Gates\n\n'
        printf -- '- `pnpm test.unit` green\n'
        printf -- '- `pnpm lint` green\n'
        printf -- '- `pnpm build.types` green\n'
        printf -- '- `pnpm build` green\n'
        printf -- '- changed-file `prettier --check` green\n\n'
        printf 'Gates ran in a clean detached checkout after the engine verified that the test-file hashes match the ones written before implementation.\n\n'
        printf '### QA and visual evidence\n\n'
        if [[ -s "$LOG_DIR/qa-urls.tsv" ]]; then
            while IFS=$'\t' read -r qname qurl; do
                [[ -n "$qurl" ]] && printf -- '- ![qa %s](%s)\n' "$qname" "$qurl"
            done <"$LOG_DIR/qa-urls.tsv"
            printf '\n'
        else
            printf -- '- Playwright QA passed; screenshots at `factory/logs/issue-%s/qa/` (upload unavailable).\n\n' "$n"
        fi
        printf '### Review\n\n'
        printf '```json\n%s\n```\n\n' "$review_json"
        printf 'This PR is a draft. The factory never merges; merging is the human gate.\n'
    } >"$LOG_DIR/evidence.md"
}

ship() {
    local n=$1 title=$2 files url existing
    if (( NO_SHIP )); then
        files=$(join_comma <"$LOG_DIR/spec-files.txt")
        write_evidence "$n" "$title" "$files"
        log "no-ship: branch $BRANCH ready; evidence at factory/logs/issue-$n/evidence.md"
        return 3
    fi
    publish_qa_artifacts "$n"
    files=$(join_comma <"$LOG_DIR/spec-files.txt")
    write_evidence "$n" "$title" "$files"
    printf 'Closes #%s\n' "$n" >>"$LOG_DIR/evidence.md"
    git -C "$WT" push -u origin "$BRANCH" >"$LOG_DIR/push.log" 2>&1 || return 1
    existing=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null)
    if [[ -z "$existing" || "$existing" == "null" ]]; then
        gh pr create --draft --base master --head "$BRANCH" \
            --title "Factory: $title (#$n)" \
            --body-file "$LOG_DIR/evidence.md" >"$LOG_DIR/pr.log" 2>&1 || return 1
    else
        log "draft PR already exists: #$existing; updating its body"
        gh pr edit "$existing" --body-file "$LOG_DIR/evidence.md" >"$LOG_DIR/pr.log" 2>&1 || return 1
    fi
    url=$(gh pr view "$BRANCH" --json url --jq '.url' 2>/dev/null)
    gh issue edit "$n" --remove-label factory:wip --add-label factory:review >/dev/null 2>&1 || true
    gh issue comment "$n" --body "Factory opened a draft PR: $url" >/dev/null 2>&1 || true
    remove_worktree "$WT"
    return 0
}
