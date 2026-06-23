#!/bin/bash
set -e

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "🚀 Starting zkProof Frontend Demo"
echo "============================================="
echo "This script starts the React + Vite development server."
echo "Vite is configured to automatically open your browser to:"
echo "👉 http://localhost:3000"
echo ""
echo "Once the page loads, the interactive demo tour will walk you"
echo "through wallet connection, proof generation, and verification."
echo ""
echo "Press Ctrl+C to stop the development server."
echo "============================================="

cd "$ROOT_DIR/frontend"
npm run dev
