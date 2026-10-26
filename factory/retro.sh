#!/usr/bin/env bash
set -euo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$FACTORY_DIR/.." && pwd)"
LEDGER="$FACTORY_DIR/retro/LEDGER.md"

usage() {
    cat <<'EOF'
Usage:
  factory/retro.sh --merged <issue> --sha <merge-sha> --edits <kind> [--no-commit]
  factory/retro.sh --stats

--merged records the outcome of a merged factory PR: updates the ledger line
for the issue and appends a Merge record to factory/retro/issue-<issue>.md,
then commits both files on the current branch.

  --sha     merge commit sha (short or full)
  --edits   none | spec | tests | code | other   (what you fixed by hand)
  --no-commit  modify the files but leave the commit to you

--stats prints tag, outcome, and human-edit counts across the ledger.
EOF
}

die() {
    printf 'retro.sh: %s\n' "$*" >&2
    exit 1
}

factory_busy() {
    local pidfile="$FACTORY_DIR/state/run.lock/pid" pid
    [[ -f "$pidfile" ]] || return 1
    pid=$(cat "$pidfile" 2>/dev/null) || return 1
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

MODE=""
ISSUE=""
SHA=""
EDITS=""
NO_COMMIT=0

while (( $# > 0 )); do
    case "$1" in
        --merged)
            MODE="merged"
            ISSUE="${2:-}"
            shift 2
            ;;
        --stats)
            MODE="stats"
            shift
            ;;
        --sha)
            SHA="${2:-}"
            shift 2
            ;;
        --edits)
            EDITS="${2:-}"
            shift 2
            ;;
        --no-commit)
            NO_COMMIT=1
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

[[ -n "$MODE" ]] || {
    usage >&2
    exit 1
}

if [[ "$MODE" == "stats" ]]; then
    [[ -f "$LEDGER" ]] || die "no ledger at factory/retro/LEDGER.md"
    awk -F' \\| ' '
        /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/ {
            total++
            outcome[$3]++
            n = split($6, tags, /, */)
            for (i = 1; i <= n; i++) {
                if (tags[i] != "" && tags[i] != "none") tagcount[tags[i]]++
            }
            if ($7 != "-") merged++
            if ($8 != "-") edits[$8]++
        }
        END {
            printf "issues: %d\n", total
            printf "outcomes:\n"
            for (o in outcome) printf "  %s %d\n", o, outcome[o]
            printf "tags:\n"
            for (t in tagcount) printf "  %s %d\n", t, tagcount[t]
            printf "merged recorded: %d\n", merged + 0
            printf "human edits:\n"
            for (e in edits) printf "  %s %d\n", e, edits[e]
        }
    ' "$LEDGER"
    exit 0
fi

[[ "$ISSUE" =~ ^[0-9]+$ ]] || die "--merged requires --issue <number>"
[[ "$SHA" =~ ^[0-9a-fA-F]{4,40}$ ]] || die "--sha requires a hex sha, got: $SHA"
case "$EDITS" in
    none | spec | tests | code | other) ;;
    *) die "--edits must be none|spec|tests|code|other, got: $EDITS" ;;
esac
factory_busy && die "a factory run is active; wait for it to finish"
[[ -f "$LEDGER" ]] || die "no ledger at factory/retro/LEDGER.md"

RETRO_FILE="$FACTORY_DIR/retro/issue-$ISSUE.md"
[[ -f "$RETRO_FILE" ]] || die "no retro file at factory/retro/issue-$ISSUE.md"
grep -q '## Merge record' "$RETRO_FILE" && die "issue #$ISSUE already has a merge record; edit the file by hand"

SHORT_SHA="${SHA:0:7}"
TMP=$(mktemp)
awk -F' \\| ' -v OFS=' | ' -v n="#$ISSUE" -v sha="$SHORT_SHA" -v edits="$EDITS" '
    {
        if ($2 == n) {
            $7 = sha
            $8 = edits
        }
        print
    }
' "$LEDGER" >"$TMP"
mv "$TMP" "$LEDGER"

{
    printf '\n### Merge record\n\n'
    printf -- '- merged: %s on %s\n' "$SHORT_SHA" "$(date '+%F')"
    printf -- '- human edits: %s\n' "$EDITS"
} >>"$RETRO_FILE"

cd "$REPO_DIR"
if (( NO_COMMIT )); then
    printf 'updated %s and %s (not committed)\n' \
        "factory/retro/LEDGER.md" "factory/retro/issue-$ISSUE.md"
    exit 0
fi
git commit -m "docs(factory): record merge of #$ISSUE ($SHORT_SHA)" -- \
    factory/retro/LEDGER.md "factory/retro/issue-$ISSUE.md" \
    || die "git commit failed; files are updated, commit them by hand"
printf 'recorded merge of #%s (%s, edits: %s)\n' "$ISSUE" "$SHORT_SHA" "$EDITS"
