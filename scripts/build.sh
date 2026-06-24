#!/bin/bash
# Build the Noir circuit and the Soroban contract WASM.
# Idempotent: rebuilds are incremental.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
NARGO="/home/lowkey/.nargo/bin/nargo"

export PATH="/home/lowkey/.cargo/bin:/home/lowkey/.nargo/bin:$PATH"

if ! command -v "$NARGO" >/dev/null 2>&1; then
  echo "nargo not found at $NARGO. Install with: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup"
  exit 1
fi

# 1. Build circuit
echo "==> Compiling Noir circuit..."
(cd "$ROOT_DIR/circuits" && nargo compile)
if [ ! -f "$ROOT_DIR/circuits/target/zkproof.json" ]; then
  echo "❌ Circuit compilation failed: target/zkproof.json not produced"
  exit 1
fi
echo "✅ Circuit compiled: $ROOT_DIR/circuits/target/zkproof.json"

# 2. Run circuit tests
echo "==> Running circuit tests..."
(cd "$ROOT_DIR/circuits" && nargo test) | tail -10

# 3. Copy circuit artifact to frontend public dir
mkdir -p "$ROOT_DIR/frontend/public"
cp -f "$ROOT_DIR/circuits/target/zkproof.json" "$ROOT_DIR/frontend/public/zkproof.json"
echo "✅ Copied circuit to frontend/public/zkproof.json"

# 4. Build contract
echo "==> Building Soroban contract WASM..."
(cd "$ROOT_DIR/contracts" && cargo build --target wasm32v1-none --release)
WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/zkproof_contract.wasm"
if [ ! -f "$WASM" ]; then
  echo "❌ Contract build failed: WASM not found at $WASM"
  exit 1
fi
echo "✅ Contract WASM: $WASM ($(du -h "$WASM" | cut -f1))"

echo
echo "Build complete."
