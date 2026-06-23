#!/bin/bash
set -e

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "🧪 Running zkProof End-to-End Test Flow"
echo "============================================="

IDENTITY_NAME="zkproof_dev"
CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"

if [ ! -f "$CONTRACT_ID_FILE" ]; then
  echo "❌ Contract ID file not found. Please run deploy.sh first."
  exit 1
fi

CONTRACT_ID=$(cat "$CONTRACT_ID_FILE")
USER_ADDRESS=$(stellar keys address "$IDENTITY_NAME")

echo "Using contract: $CONTRACT_ID"
echo "Using address:  $USER_ADDRESS"

# 1. Store the mock verification key (pre-requisite for proof validation)
echo "---------------------------------------------"
echo "⚙️  1. Setting up mock verification key..."
VK_HEX="5a4b50560000000140$(printf '0%.0s' {1..382})"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- store_verification_key \
  --admin "$USER_ADDRESS" \
  --vk "$VK_HEX"
echo "✅ Verification key successfully stored."

# 2. Call attest() with a mock proof matching the verification key
echo "---------------------------------------------"
echo "🔐 2. Calling attest() with a mock proof..."
THRESHOLD_HEX="0000000000000000000000000000000000000000000000000000000000000bb8" # 3000
TYPE_HEX="0000000000000000000000000000000000000000000000000000000000000001" # 1 = income
TIMESTAMP_HEX="00000000000000000000000000000000000000000000000000000000684ee180" # 1750000000
COMMITMENT_HEX="000000000000000000000000000000000000000000000000000000000000002a" # 42
G1_INF_HEX="40$(printf '0%.0s' {1..190})"
PROOF_HEX="${THRESHOLD_HEX}${TYPE_HEX}${TIMESTAMP_HEX}${COMMITMENT_HEX}${G1_INF_HEX}"

ATTEST_RESULT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- attest \
  --user "$USER_ADDRESS" \
  --proof "$PROOF_HEX" \
  --attestation_type income \
  --threshold 3000)

echo "Result: $ATTEST_RESULT"
if [ "$ATTEST_RESULT" = "true" ]; then
  echo "✅ Attest completed and verified successfully!"
else
  echo "❌ Attest rejected or failed."
  exit 1
fi

# 3. Call check() to verify the attestation exists
echo "---------------------------------------------"
echo "🔍 3. Calling check() to verify attestation..."
CHECK_RESULT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- check \
  --address "$USER_ADDRESS" \
  --attestation_type income)

echo "Result: $CHECK_RESULT"
if [ "$CHECK_RESULT" = "true" ]; then
  echo "✅ Attestation verification check returned: YES"
else
  echo "❌ Attestation verification check returned: NO"
  exit 1
fi

# 4. Call get_attestation() to see details
echo "---------------------------------------------"
echo "📋 4. Calling get_attestation() to query details..."
DETAILS=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- get_attestation \
  --address "$USER_ADDRESS" \
  --attestation_type income)
echo "Attestation details retrieved:"
echo "$DETAILS"

# 5. Call revoke() to remove the attestation
echo "---------------------------------------------"
echo "🚫 5. Calling revoke() to remove the attestation..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- revoke \
  --user "$USER_ADDRESS" \
  --attestation_type income
echo "✅ Revocation call submitted."

# 6. Call check() again to confirm it's gone
echo "---------------------------------------------"
echo "🔍 6. Calling check() again to verify revocation..."
CHECK_REVOKED=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY_NAME" \
  --network testnet \
  -- check \
  --address "$USER_ADDRESS" \
  --attestation_type income)

echo "Result: $CHECK_REVOKED"
if [ "$CHECK_REVOKED" = "false" ]; then
  echo "✅ Verification check returned: NO (successfully revoked)"
else
  echo "❌ Verification check still returned: YES (revocation failed)"
  exit 1
fi

echo "============================================="
echo "🎉 E2E Flow test completed successfully!"
echo "============================================="
