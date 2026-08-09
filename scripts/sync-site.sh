#!/usr/bin/env bash
# Sync site/ -> docs/ (the GitHub Pages deploy dir).
#
# Use this instead of a bare `rsync -a --delete site/ docs/`. Internal notes
# living in site/ were being published: PRODUCT-DECISIONS.md and URL-SCHEME.md
# both contained live agent passwords, and every one of them was reachable at
# https://premarketagents.com/<name>.md
#
# --delete-excluded matters: without it, excluded files already sitting in
# docs/ would be left behind rather than removed.
set -euo pipefail

cd "$(dirname "$0")/.."

rsync -a --delete --delete-excluded \
  --exclude='*.md' \
  --exclude='.private-salt' \
  site/ docs/

echo "synced site/ -> docs/"
echo "excluded: *.md (internal notes), .private-salt (reverses image hashing)"
