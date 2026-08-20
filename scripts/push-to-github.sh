#!/usr/bin/env bash
set -euo pipefail

# Push all branches to GitHub. Requires GITHUB_TOKEN with repo scope.
# Usage: GITHUB_TOKEN=ghp_xxx ./scripts/push-to-github.sh

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: set GITHUB_TOKEN (GitHub PAT with repo scope)." >&2
  exit 1
fi

REMOTE="https://${GITHUB_TOKEN}@github.com/Kevin32456/test.git"

git push "$REMOTE" main
git push "$REMOTE" --all
git push "$REMOTE" --tags

echo "Done. Remote origin: https://github.com/Kevin32456/test.git"
