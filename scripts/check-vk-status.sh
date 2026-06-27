#!/bin/bash
# Check whether the deployed contract is still using the placeholder VK.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/home/lowkey/.cargo/bin:$PATH"

IDENTITY_NAME="${IDENTITY_NAME:-zkproof_dev}"
NETWORK="${NETWORK:-testnet}"
CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"
EXPECTED_VK_BYTES=1760

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ No .contract-id found. Run ./scripts/deploy.sh first."
  exit 1
fi

CID=$(cat "$CONTRACT_ID_FILE")
RAW=$(stellar contract invoke \
  --id "$CID" \
  --source-account "$IDENTITY_NAME" \
  --network "$NETWORK" \
  -- get_verification_key)

HEX=$(printf '%s' "$RAW" | tr -d '\n\r\t \"')

if [ -z "$HEX" ] || [ "$HEX" = "null" ]; then
  echo "❌ No verification key stored on-chain."
  exit 1
fi

BYTE_LEN=$(( ${#HEX} / 2 ))
if printf '%s' "$HEX" | grep -Eq '^[0]+$'; then
  echo "PLACEHOLDER $BYTE_LEN bytes"
  exit 2
fi

if [ "$BYTE_LEN" -ne "$EXPECTED_VK_BYTES" ]; then
  echo "INVALID $BYTE_LEN bytes (expected $EXPECTED_VK_BYTES) ${HEX:0:32}..."
  exit 3
fi

echo "REAL $BYTE_LEN bytes ${HEX:0:32}..."
