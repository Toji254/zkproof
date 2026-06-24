#!/bin/bash
# Generate + fund a Stellar testnet identity for zkProof.
# Idempotent: re-running after a successful setup is a no-op.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

IDENTITY_NAME="${IDENTITY_NAME:-zkproof_dev}"
NETWORK="testnet"
FRIENDBOT_URL="https://friendbot.stellar.org"

# Ensure stellar CLI is on PATH
export PATH="/home/lowkey/.cargo/bin:$PATH"

if ! command -v stellar >/dev/null 2>&1; then
  echo "stellar CLI not found on PATH. Install it from"
  echo "  https://github.com/stellar/stellar-cli/releases"
  exit 1
fi

# Generate the identity if it doesn't exist
if stellar keys ls 2>/dev/null | grep -q "$IDENTITY_NAME"; then
  echo "✅ Identity '$IDENTITY_NAME' already exists"
else
  echo "Generating new Stellar identity '$IDENTITY_NAME'..."
  stellar keys generate "$IDENTITY_NAME"
  echo "✅ Identity created"
fi

PUB_KEY=$(stellar keys address "$IDENTITY_NAME")
echo "Public key: $PUB_KEY"

# Friendbot fund (testnet only)
echo "Funding account from friendbot..."
RESP=$(curl -fsS "$FRIENDBOT_URL?addr=$PUB_KEY" 2>&1) || {
  echo "Friendbot funding failed. Response: $RESP"
  exit 1
}
echo "✅ Funded"

# Brief check
BAL=$(stellar keys balance "$IDENTITY_NAME" 2>/dev/null || echo "unknown")
echo "Balance: $BAL"

echo
echo "Identity '$IDENTITY_NAME' is ready for use."
echo "Default network: $(stellar network ls 2>/dev/null | head -1 || echo testnet)"
