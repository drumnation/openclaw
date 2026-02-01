#!/bin/bash
# Backup all non-git precious files before destructive operations
# Usage: ./scripts/backup-env.sh [backup|restore]

set -euo pipefail

BACKUP_DIR="$HOME/.clawdbot/fork-backups/$(date +%Y%m%d-%H%M%S)"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

backup() {
    mkdir -p "$BACKUP_DIR"
    
    # Backup .env files
    find "$REPO_ROOT" -name ".env" -not -path "*/node_modules/*" -exec cp --parents {} "$BACKUP_DIR/" \; 2>/dev/null || true
    find "$REPO_ROOT" -name ".env.local" -not -path "*/node_modules/*" -exec cp --parents {} "$BACKUP_DIR/" \; 2>/dev/null || true
    
    # Backup clawdbot config
    cp "$HOME/.clawdbot/clawdbot.json" "$BACKUP_DIR/clawdbot.json" 2>/dev/null || true
    
    # Record git state
    cd "$REPO_ROOT"
    git rev-parse HEAD > "$BACKUP_DIR/git-head.txt" 2>/dev/null || true
    git branch --show-current > "$BACKUP_DIR/git-branch.txt" 2>/dev/null || true
    git stash list > "$BACKUP_DIR/git-stashes.txt" 2>/dev/null || true
    git diff --stat > "$BACKUP_DIR/git-uncommitted.txt" 2>/dev/null || true
    
    echo "Backup saved to: $BACKUP_DIR"
    ls -la "$BACKUP_DIR/"
}

restore() {
    LATEST=$(ls -td "$HOME/.clawdbot/fork-backups/"*/ 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
        echo "No backups found"
        exit 1
    fi
    echo "Latest backup: $LATEST"
    echo "Git was at: $(cat "$LATEST/git-head.txt" 2>/dev/null || echo 'unknown')"
    echo "On branch: $(cat "$LATEST/git-branch.txt" 2>/dev/null || echo 'unknown')"
    echo ""
    echo "To restore clawdbot config:"
    echo "  cp '$LATEST/clawdbot.json' ~/.clawdbot/clawdbot.json"
    echo ""
    echo "To restore git state:"
    echo "  git checkout \$(cat '$LATEST/git-branch.txt')"
    echo "  git reset --hard \$(cat '$LATEST/git-head.txt')"
}

case "${1:-backup}" in
    backup) backup ;;
    restore) restore ;;
    *) echo "Usage: $0 [backup|restore]" ;;
esac
