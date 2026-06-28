#!/bin/bash
# Full end-to-end regression test for zkProof.
#
# This now verifies the real happy path:
# renter input -> browser-style proof generation -> Soroban verification ->
# attestation stored on-chain, plus the below-threshold failure path.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/home/lowkey/.cargo/bin:$PATH"

CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ No .contract-id found. Run ./scripts/deploy.sh first."
  exit 1
fi

CID=$(tr -d '[:space:]' < "$CONTRACT_ID_FILE")
echo "Running full flow against contract $CID"

echo
"$SCRIPT_DIR/check-vk-status.sh"

echo
node "$ROOT_DIR/frontend/scripts/e2e-flow.mjs"

echo
echo "✅ test-flow.sh passed"
