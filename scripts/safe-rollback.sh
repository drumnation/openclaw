#!/bin/bash
# Safe rollback: undo last N commits while preserving .env and config
# Usage: ./scripts/safe-rollback.sh [N]  (default: 1 commit)
#        ./scripts/safe-rollback.sh --to COMMIT_HASH

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Pre-flight: backup precious files
echo "=== Backing up precious files ==="
./scripts/backup-env.sh backup

# Stash any uncommitted work
if [ -n "$(git status --porcelain)" ]; then
    echo "=== Stashing uncommitted changes ==="
    git stash push -m "safe-rollback-$(date +%Y%m%d-%H%M%S)"
fi

if [ "${1:-}" = "--to" ] && [ -n "${2:-}" ]; then
    echo "=== Rolling back to commit: $2 ==="
    git reset --hard "$2"
elif [ -n "${1:-}" ]; then
    echo "=== Rolling back $1 commit(s) ==="
    git reset --hard "HEAD~$1"
else
    echo "=== Rolling back 1 commit ==="
    git reset --hard "HEAD~1"
fi

echo ""
echo "=== Current state ==="
git log --oneline -5
echo ""
echo "Stashed changes available via: git stash list"
echo "Backup available via: ./scripts/backup-env.sh restore"
