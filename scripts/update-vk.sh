#!/bin/bash
# Update the on-chain VK with a real one produced by `bb write_vk`.
# Run this AFTER ./scripts/build.sh (which compiles the circuit) and AFTER
# the frontend prover has been built at least once (which is when `bb` is
# available in node_modules).
#
# Usage: ./scripts/update-vk.sh [path/to/real-vk.bin]
#   Default path: circuits/target/vk.bin
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/home/lowkey/.cargo/bin:$PATH"

IDENTITY_NAME="${IDENTITY_NAME:-zkproof_dev}"
NETWORK="testnet"
CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"
VK_FILE="${1:-$ROOT_DIR/circuits/target/vk.bin}"

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ No .contract-id found. Run ./scripts/deploy.sh first."
  exit 1
fi

if [ ! -f "$VK_FILE" ]; then
  echo "❌ VK file not found at $VK_FILE"
  echo "   Run the frontend dev server once (or `cd frontend && node scripts/gen-vk.mjs`)"
  echo "   to produce circuits/target/vk.bin from the compiled circuit."
  exit 1
fi

CID=$(cat "$CONTRACT_ID_FILE")
echo "Uploading VK ($VK_FILE) to contract $CID on $NETWORK..."

VK_HEX=$(xxd -p -c 100000 "$VK_FILE" | tr -d '\n')
stellar contract invoke \
  --id "$CID" \
  --source-account "$IDENTITY_NAME" \
  --network "$NETWORK" \
  -- store_verification_key \
  --admin "$(stellar keys address "$IDENTITY_NAME")" \
  --vk "$VK_HEX"

echo "✅ VK uploaded."
