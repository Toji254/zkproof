#!/bin/bash
set -e

echo "============================================="
echo "⚙️  Setting up zkProof development environment"
echo "============================================="

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Check for required tools
MISSING_TOOLS=0

check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "❌ $1 is not installed."
    echo "   👉 $2"
    MISSING_TOOLS=1
  else
    echo "✅ $1 is installed."
  fi
}

check_tool "cargo" "Install Rust and Cargo: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
check_tool "stellar" "Install Stellar CLI: cargo install --locked stellar-cli --features opt"
check_tool "nargo" "Install Noir / Nargo: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash; noirup"
check_tool "node" "Install Node.js: https://nodejs.org/"

if [ $MISSING_TOOLS -ne 0 ]; then
  echo ""
  echo "⚠️  Please install the missing tools above and rerun setup.sh."
  exit 1
fi

# 2. Add Stellar Testnet network if not present
echo "Adding Stellar Testnet network configuration to CLI..."
stellar network add --global testnet \
  --rpc-url "https://soroban-testnet.stellar.org:443" \
  --network-passphrase "Test SDF Network ; September 2015" 2>/dev/null || true

# 3. Generate keypair if not exists
IDENTITY_NAME="zkproof_dev"
echo "Checking Stellar identity '$IDENTITY_NAME'..."

if stellar keys address "$IDENTITY_NAME" &> /dev/null; then
  PUB_KEY=$(stellar keys address "$IDENTITY_NAME")
  echo "✅ Identity '$IDENTITY_NAME' already exists."
else
  echo "Creating new Stellar identity '$IDENTITY_NAME' and funding it via Friendbot..."
  stellar keys generate "$IDENTITY_NAME" --network testnet --fund
  PUB_KEY=$(stellar keys address "$IDENTITY_NAME")
  echo "✅ Identity '$IDENTITY_NAME' created."
fi

echo "Public Key: $PUB_KEY"
echo "Stellar Expert Explorer Link: https://stellar.expert/explorer/testnet/account/$PUB_KEY"

echo "============================================="
echo "🎉 Setup complete! Ready to build and deploy."
echo "============================================="
