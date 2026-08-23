#!/usr/bin/env bash
# ---------------------------------------------------------------------
# DMTAC QuickClerk — one-command publish to GitHub Pages
#
# Run this from inside the DMTAC_CCMS_Clerking_Helper folder:
#     bash publish.sh "your commit message"
#
# First run  : creates the repo (via GitHub CLI if installed), pushes,
#              and enables GitHub Pages.
# Later runs : commits any changes and pushes. That's it.
#
# It never handles your password or token — it uses whatever git/gh
# authentication you already have on this machine. If you have never
# authenticated, run `gh auth login` once first.
# ---------------------------------------------------------------------
set -euo pipefail

REPO_NAME="${REPO_NAME:-dmtac-quickclerk}"
BRANCH="main"
MSG="${1:-Update DMTAC QuickClerk}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$1"; }

# --- pre-flight: make sure we are in the right folder --------------
for f in index.html script.js style.css; do
  [ -f "$f" ] || { warn "$f not found — run this from the DMTAC_CCMS_Clerking_Helper folder."; exit 1; }
done

# --- pre-flight: refuse to publish anything that looks like a key ---
say "Scanning for accidentally committed secrets"
if grep -rInE '(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' \
     --include='*.js' --include='*.html' --include='*.json' --include='*.md' . 2>/dev/null; then
  warn "Something that looks like an API key was found above. Remove it before publishing."
  exit 1
fi
echo "    none found."

say "Files that will be published"
for f in index.html script.js style.css README.md dmtac-logo.png; do
  [ -f "$f" ] && echo "    $f"
done
if [ -f kksj-ai-proxy-worker.js ]; then
  echo "    kksj-ai-proxy-worker.js (reference only — deploy separately to Cloudflare)"
fi

# --- git init / commit ---------------------------------------------
if [ ! -d .git ]; then say "Initialising git repository"; git init -q; fi
git checkout -q -B "$BRANCH"
git add -A
if git diff --cached --quiet; then
  say "No changes to commit — nothing to publish."
  exit 0
fi
git commit -q -m "$MSG"
echo "    committed: $MSG"

# --- create remote if missing --------------------------------------
if ! git remote get-url origin >/dev/null 2>&1; then
  if command -v gh >/dev/null 2>&1; then
    say "Creating GitHub repository '$REPO_NAME' (public)"
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
    say "Enabling GitHub Pages on $BRANCH"
    gh api -X POST "repos/{owner}/$REPO_NAME/pages" \
      -f "source[branch]=$BRANCH" -f "source[path]=/" >/dev/null 2>&1 \
      || echo "    Pages may already be enabled, or enable it manually under Settings > Pages."
    URL="https://$(gh api user -q .login | tr '[:upper:]' '[:lower:]').github.io/$REPO_NAME/"
    say "Published. Your site (allow a minute or two to build):"
    echo "    $URL"
    echo
    echo "    Next: put that URL into ALLOWED_ORIGINS in kksj-ai-proxy-worker.js"
    echo "          and redeploy the Worker, so only your site can call it."
    exit 0
  else
    warn "No 'origin' remote and GitHub CLI (gh) is not installed."
    echo "    Either install it from https://cli.github.com and re-run,"
    echo "    or create an empty repo on github.com and run:"
    echo "        git remote add origin https://github.com/YOUR-USERNAME/$REPO_NAME.git"
    echo "        git push -u origin $BRANCH"
    exit 1
  fi
fi

say "Pushing to origin/$BRANCH"
git push -u origin "$BRANCH"
say "Done. GitHub Pages will rebuild automatically in a minute or two."
