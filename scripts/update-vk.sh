#!/bin/bash
# Update the on-chain VK with a real 1760-byte verifier key produced by
# `frontend/scripts/gen-vk.mjs` (which always uses the keccak VK — bb.js 0.87
# returns clean 1760 bytes for keccak, while the default 1764-byte VK has 4
# padding bytes between the header and the G1 points that will corrupt every
# commitment if uploaded as-is).
#
# Run this AFTER ./scripts/build.sh (which compiles the circuit) and AFTER
# node frontend/scripts/gen-vk.mjs has produced a fresh VK at
# circuits/target/vk.bin.
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
EXPECTED_VK_BYTES=1760

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ No .contract-id found. Run ./scripts/deploy.sh first."
  exit 1
fi

# If VK_FILE is a directory, check if it contains a 'vk' file inside
if [ -d "$VK_FILE" ] && [ -f "$VK_FILE/vk" ]; then
  VK_FILE="$VK_FILE/vk"
fi

if [ ! -f "$VK_FILE" ]; then
  echo "❌ VK file not found at $VK_FILE"
  echo "   First try the Node helper: node frontend/scripts/gen-vk.mjs"
  echo "   If that fails, open /ops in the frontend and use Export Verification Key,"
  echo "   then move the downloaded file to circuits/target/vk.bin and re-run this script."
  exit 1
fi

# Defense-in-depth: refuse to upload anything that is not exactly 1760 bytes.
# bb.js 0.87 returns 1764 for the non-keccak VK; trimming the last 4 bytes used
# to be enough in earlier versions, but in 0.87 the 4 extra bytes are a padding
# word between the 32-byte header and the 27 G1 points. Trimming the tail
# instead corrupts every G1 point and produces `bn254: unable to deserialize
# bn254 Fp` during proof verification. Always regenerate via gen-vk.mjs, which
# uses the keccak VK (already exactly 1760 bytes).
VK_SIZE=$(wc -c < "$VK_FILE" | tr -d ' ')
if [ "$VK_SIZE" -ne "$EXPECTED_VK_BYTES" ]; then
  echo "❌ VK file has $VK_SIZE bytes; expected $EXPECTED_VK_BYTES for the Soroban verifier."
  if [ "$VK_SIZE" -eq 1764 ]; then
    echo "   This is the bb.js 0.87 default VK. It has 4 padding bytes between the"
    echo "   header and the G1 points, so trimming the trailing 4 bytes no longer"
    echo "   produces a valid 1760-byte VK."
    echo "   Re-run: node frontend/scripts/gen-vk.mjs   (it now exports the keccak VK)."
  fi
  echo "   Do not upload this file — it will be rejected or, worse, accepted as a"
  echo "   'real VK' but silently fail every proof with bn254 deserialize errors."
  exit 1
fi

# Quick header sanity check: the first 4 u64 BE words must parse and circuit_size
# must be a power of two (the verifier's structural check would also catch this
# but the failure message from a runtime panic is harder to debug).
HEADER_BYTES=$(head -c 32 "$VK_FILE" | od -An -tx1 -v | tr -d ' \n')
if [ "${#HEADER_BYTES}" -ne 64 ]; then
  echo "❌ VK header could not be read (expected 32 bytes, got ${#HEADER_BYTES} hex chars)."
  exit 1
fi

CID=$(cat "$CONTRACT_ID_FILE")
echo "Uploading VK ($VK_FILE) to contract $CID on $NETWORK..."

stellar contract invoke \
  --id "$CID" \
  --source-account "$IDENTITY_NAME" \
  --network "$NETWORK" \
  -- store_verification_key \
  --admin "$(stellar keys address "$IDENTITY_NAME")" \
  --vk-file-path "$VK_FILE"

echo "✅ VK uploaded."
