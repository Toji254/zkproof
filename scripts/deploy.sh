#!/bin/bash
# Deploy the compiled zkProof contract to Stellar testnet.
# 1. Deploys the WASM with a placeholder VK
# 2. Initializes the contract
# 3. Writes the contract ID to .contract-id and frontend/.env
# 4. Use scripts/update-vk.sh later to replace the placeholder VK with the real one
#
# Idempotent: re-running with an existing .contract-id is a no-op unless FORCE=true.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/home/lowkey/.cargo/bin:$PATH"

IDENTITY_NAME="${IDENTITY_NAME:-zkproof_dev}"
NETWORK="testnet"
WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/zkproof_contract.wasm"
CONTRACT_ID_FILE="$ROOT_DIR/.contract-id"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"
PLACEHOLDER_VK="$ROOT_DIR/.vk.placeholder.bin"
FORCE_DEPLOY="${FORCE:-false}"

if [ ! -f "$WASM" ]; then
  echo "WASM not found. Run ./scripts/build.sh first."
  exit 1
fi

if [ -f "$CONTRACT_ID_FILE" ] && [ "$FORCE_DEPLOY" = "false" ]; then
  CID=$(cat "$CONTRACT_ID_FILE")
  echo "✅ Already deployed: $CID"
  echo "   Re-run with FORCE=true to redeploy."
  echo "VITE_CONTRACT_ID=$CID" > "$FRONTEND_ENV"
  echo "VITE_NETWORK=$NETWORK" >> "$FRONTEND_ENV"
  exit 0
fi

if ! stellar keys address "$IDENTITY_NAME" >/dev/null 2>&1; then
  echo "Identity '$IDENTITY_NAME' not found. Running setup.sh..."
  "$SCRIPT_DIR/setup.sh"
fi

PUB_KEY=$(stellar keys address "$IDENTITY_NAME")
echo "Deploying from $PUB_KEY on $NETWORK..."

# 0. Build placeholder VK = 1760 bytes (the verifier lib's required length).
# Until bb.js generates a real VK and ./scripts/update-vk.sh runs, the contract
# will reject any proof submission — but reads work fine.
python3 -c "
with open('$PLACEHOLDER_VK', 'wb') as f:
    f.write(bytes(1760))
" || python -c "
open('$PLACEHOLDER_VK','wb').write(bytes(1760))
"
echo "✅ Placeholder VK: $PLACEHOLDER_VK"

# 1. Deploy (constructor args after `--`)
CID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY_NAME" \
  --network "$NETWORK" \
  -- --admin "$PUB_KEY" --vk-file-path "$PLACEHOLDER_VK")
echo "✅ Deployed: $CID"

# 2. The contract was initialized by the constructor during deploy.
echo "✅ Contract initialized via constructor (admin=$PUB_KEY, placeholder VK)"

# 4. Persist the contract ID
echo "$CID" > "$CONTRACT_ID_FILE"
echo "VITE_CONTRACT_ID=$CID" > "$FRONTEND_ENV"
echo "VITE_NETWORK=$NETWORK" >> "$FRONTEND_ENV"

echo
echo "🎉 Deployment complete!"
echo "Contract ID: $CID"
echo "Testnet explorer: https://stellar.expert/explorer/testnet/contract/$CID"
echo
echo "NOTE: The VK is currently a placeholder. Once the frontend is built and"
echo "bb.js can produce a real VK, run ./scripts/update-vk.sh to upload it."
