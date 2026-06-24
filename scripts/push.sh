#!/bin/bash
set -e

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "============================================="
echo "🐙 Pushing zkProof to GitHub"
echo "============================================="

# 1. Check if git is initialized
if [ ! -d ".git" ]; then
  echo "Git repository not detected. Initializing git..."
  git init -b main
  echo "✅ Git repository initialized on branch 'main'."
else
  echo "✅ Git repository already initialized."
fi

# 2. Check if a remote is configured
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
  echo "⚠️  No remote 'origin' is configured."
  echo "Please enter your GitHub repository URL (e.g., https://github.com/yourusername/zkproof.git):"
  read -r REMOTE_URL
  if [ -z "$REMOTE_URL" ]; then
    echo "❌ No remote URL provided. Aborting push."
    exit 1
  fi
  git remote add origin "$REMOTE_URL"
  echo "✅ Added remote origin: $REMOTE_URL"
else
  echo "✅ Remote origin is configured: $REMOTE_URL"
fi

# 3. Add files and commit
echo "Staging files..."
git add .

# Check if there are changes to commit
if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "ℹ️  No changes to commit."
else
  echo "Committing changes..."
  git commit -m "feat: Stellar wallet integration, Soroban verifier, test scripts, and animations"
  echo "✅ Changes committed."
fi

# 4. Push to origin main
echo "Pushing code to GitHub..."
git push -u origin main

echo "============================================="
echo "🎉 Push complete!"
echo "============================================="
