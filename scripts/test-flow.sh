#!/bin/bash
# End-to-end smoke test against a freshly-deployed zkProof contract on testnet.
# Verifies the contract responds to the read-only functions correctly.
#
# NOTE: this script exercises the contract's *registry* surface only — it does
# NOT generate a real UltraHonk proof (that requires bb.js, which the CLI
# doesn't run). The full attest() path is exercised by the frontend end-to-end
# test, where a user signs a transaction in a wallet.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/home/lowkey/.cargo/bin:$PATH"

IDENTITY_NAME="${IDENTITY_NAME:-zkproof_dev}"
NETWORK="testnet"
CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ No .contract-id found. Run ./scripts/deploy.sh first."
  exit 1
fi
CID=$(cat "$CONTRACT_ID_FILE")
echo "Smoke-testing contract $CID on $NETWORK"

USER=$(stellar keys address "$IDENTITY_NAME")
echo "Using identity $IDENTITY_NAME = $USER"

# Helper: invoke a contract function with the testnet identity as source
# Usage: invoke <fn> [args...]
invoke() {
  local fn="$1"; shift
  stellar contract invoke \
    --id "$CID" \
    --source-account "$IDENTITY_NAME" \
    --network "$NETWORK" \
    -- "$fn" "$@"
}

# 1. total_attestations should be 0 (fresh deploy)
echo
echo "==> 1. total_attestations (should be 0):"
invoke total_attestations

# 2. check() for a fresh user — should be false
echo
echo "==> 2. check(user, income) for fresh user (should be false):"
invoke check --address "$USER" --attestation_type income

# 3. get_attestation() should be None
echo
echo "==> 3. get_attestation(user, income) for fresh user (should be absent):"
invoke get_attestation --address "$USER" --attestation_type income || true

# 4. Verification-key status — fail loudly if the contract still holds the
# placeholder zeros. A real attestation demo is not trustworthy until this is
# replaced with the circuit's real VK.
echo
echo "==> 4. verification key status:"
set +e
VK_STATUS_OUTPUT="$($SCRIPT_DIR/check-vk-status.sh 2>&1)"
VK_STATUS_EXIT=$?
set -e
echo "$VK_STATUS_OUTPUT"
if [ $VK_STATUS_EXIT -eq 2 ]; then
  echo "❌ Placeholder VK is still deployed. Export a real VK from /ops or fix the generator, then run ./scripts/update-vk.sh."
  exit 1
fi
if [ $VK_STATUS_EXIT -eq 3 ]; then
  echo "❌ The deployed VK length is wrong. A hex-encoded blob was likely uploaded instead of raw verifier bytes. Redeploy or re-upload with ./scripts/update-vk.sh after generating a 1760-byte VK."
  exit 1
fi
if [ $VK_STATUS_EXIT -ne 0 ]; then
  echo "❌ Could not verify the deployed VK status."
  exit $VK_STATUS_EXIT
fi

echo
echo "✅ Smoke test passed. The contract is live and responsive on testnet."
echo "   The full attest() path requires a browser-side UltraHonk proof —"
echo "   exercise it by opening the frontend, connecting a wallet, and"
echo "   running through the four steps."
