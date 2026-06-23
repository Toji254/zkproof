#!/bin/bash
set -e

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "🚀 Deploying zkProof Soroban Contract"
echo "============================================="

IDENTITY_NAME="zkproof_dev"

# Ensure we have our testnet identity funded
if ! stellar keys address "$IDENTITY_NAME" &> /dev/null; then
  echo "⚠️  Stellar identity '$IDENTITY_NAME' not found. Running setup.sh first..."
  "$SCRIPT_DIR/setup.sh"
fi

PUB_KEY=$(stellar keys address "$IDENTITY_NAME")

# Locate compiled contract WASM
WASM_PATH=""
if [ -f "$ROOT_DIR/target/wasm32-unknown-unknown/release/zkproof_contract.wasm" ]; then
  WASM_PATH="$ROOT_DIR/target/wasm32-unknown-unknown/release/zkproof_contract.wasm"
elif [ -f "$ROOT_DIR/contracts/target/wasm32-unknown-unknown/release/zkproof_contract.wasm" ]; then
  WASM_PATH="$ROOT_DIR/contracts/target/wasm32-unknown-unknown/release/zkproof_contract.wasm"
fi

CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"
FORCE_DEPLOY=${FORCE:-false}

if [ -f "$CONTRACT_ID_FILE" ] && [ "$FORCE_DEPLOY" = "false" ]; then
  CONTRACT_ID=$(cat "$CONTRACT_ID_FILE")
  echo "ℹ️  Contract is already deployed at ID: $CONTRACT_ID"
  echo "   (To force a redeployment, run: FORCE=true ./deploy.sh)"
else
  # Compile if wasm is missing
  if [ -z "$WASM_PATH" ]; then
    echo "⚠️  WASM file not found. Compiling contract..."
    "$SCRIPT_DIR/build.sh"
    # Find WASM path again
    if [ -f "$ROOT_DIR/target/wasm32-unknown-unknown/release/zkproof_contract.wasm" ]; then
      WASM_PATH="$ROOT_DIR/target/wasm32-unknown-unknown/release/zkproof_contract.wasm"
    elif [ -f "$ROOT_DIR/contracts/target/wasm32-unknown-unknown/release/zkproof_contract.wasm" ]; then
      WASM_PATH="$ROOT_DIR/contracts/target/wasm32-unknown-unknown/release/zkproof_contract.wasm"
    fi
  fi

  if [ -z "$WASM_PATH" ]; then
    echo "❌ Failed to locate compiled WASM file. Aborting."
    exit 1
  fi

  echo "Deploying contract wasm from $WASM_PATH..."
  CONTRACT_ID=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source-account "$IDENTITY_NAME" \
    --network testnet)

  echo "✅ Deployed successfully! Contract ID: $CONTRACT_ID"
  echo "$CONTRACT_ID" > "$CONTRACT_ID_FILE"

  # Initialize contract
  echo "Initializing contract with admin: $PUB_KEY..."
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source-account "$IDENTITY_NAME" \
    --network testnet \
    -- initialize \
    --admin "$PUB_KEY"
  echo "✅ Contract successfully initialized."
fi

# Update frontend config
CONFIG_FILE="$ROOT_DIR/frontend/src/lib/config.js"
if [ -f "$CONFIG_FILE" ]; then
  sed -i "s/export const CONTRACT_ID = [\"'][^\"']*[\"']/export const CONTRACT_ID = '$CONTRACT_ID'/g" "$CONFIG_FILE"
  echo "✅ Updated frontend config: $CONFIG_FILE"
else
  echo "⚠️  Frontend config.js not found at: $CONFIG_FILE"
fi

echo "============================================="
echo "🎉 Deployment complete!"
echo "Contract ID: $CONTRACT_ID"
echo "Stellar Expert Link: https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo "============================================="
