#!/bin/bash
set -e

# Find the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "🔨 Building zkProof components"
echo "============================================="

# 1. Build Noir circuit
echo "Building Noir circuit..."
if [ -d "$ROOT_DIR/circuits" ]; then
  cd "$ROOT_DIR/circuits"
  if nargo compile; then
    echo "✅ Noir circuit compiled successfully!"
  else
    echo "❌ Noir circuit compilation failed."
    exit 1
  fi
else
  echo "⚠️  'circuits' directory not found, skipping."
fi

# 2. Build Soroban contract
echo "Building Soroban smart contract..."
if [ -d "$ROOT_DIR/contracts" ]; then
  cd "$ROOT_DIR/contracts"
  # Try using stellar contract build first
  if command -v stellar &> /dev/null && stellar contract build &> /dev/null; then
    echo "✅ Soroban contract built successfully via stellar CLI!"
  else
    echo "Stellar CLI build failed or not found. Falling back to direct Cargo build..."
    if cargo build --target wasm32-unknown-unknown --release; then
      echo "✅ cargo build (wasm32) succeeded!"
    else
      echo "❌ Soroban contract build failed."
      exit 1
    fi
  fi
else
  echo "⚠️  'contracts' directory not found, skipping."
fi

echo "============================================="
echo "🎉 All builds completed successfully!"
echo "============================================="
