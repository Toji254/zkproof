// Real ZK prover for the zkProof circuit.
//
// Wraps @aztec/bb.js (Barretenberg v0.87.0 WASM) + @noir-lang/noir_js
// to:
//   1. Load the compiled Noir circuit from /zkproof.json
//   2. Compute a Poseidon BN254 commitment
//   3. Execute the witness
//   4. Generate an UltraHonk proof via bb.js
//   5. Return the public inputs + proof ready for the on-chain contract
//
// The 4 user public inputs (one 32-byte Field each, big-endian):
//   [0] minimum_threshold   (u64 in the low 8 bytes)
//   [1] attestation_type    (1=income, 2=balance, 3=credit)
//   [2] timestamp           (u64, unix seconds)
//   [3] data_commitment     (Poseidon hash of [data_source_secret, value])
//
// bb.js (~150MB unpacked) and noir_js are dynamically imported on first use
// so the dev server boots instantly. Subsequent calls reuse the cached module.

import { poseidon2 as poseidonHash2 } from "poseidon-lite";

const EXPECTED_ONCHAIN_VK_BYTES = 1760;

export interface ProverInputs {
  attestationType: "income" | "balance" | "credit";
  threshold: bigint | number; // u64
  privateValue: bigint | number; // the secret (e.g. income / balance / credit score)
  dataSourceSecret: number; // field element used in the commitment
}

export interface ProverOutput {
  publicInputs: Uint8Array; // 128 bytes (4 × 32-byte Field)
  proof: Uint8Array; // ~14,592 bytes
  proofHex: string; // 0x-prefixed hex for display
  commitment: bigint; // the Poseidon commitment as a Field integer
  commitmentHex: string;
  vk: Uint8Array; // 1760-byte on-chain verification key
  timestamp: number; // unix seconds used inside the proof
  durationMs: number;
}

let initPromise: Promise<void> | null = null;
let bbModule: any = null;
let noirModule: any = null;
let ultraHonkBackend: any = null;
let circuitArtifact: any = null;
let cachedVK: Uint8Array | null = null;

async function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // 1. Load the circuit artifact (built by scripts/build.sh)
    const resp = await fetch("/zkproof.json");
    if (!resp.ok) {
      throw new Error(
        `Failed to load /zkproof.json (HTTP ${resp.status}). ` +
          `Run ./scripts/build.sh to compile the circuit.`,
      );
    }
    circuitArtifact = await resp.json();
    if (!circuitArtifact.bytecode) {
      throw new Error("Circuit artifact missing 'bytecode' field. Re-run nargo compile.");
    }

    // 2. Lazy-load bb.js + noir_js (one-time ~150MB download)
    bbModule = await import("@aztec/bb.js");
    noirModule = await import("@noir-lang/noir_js");

    // 3. Build the UltraHonk backend from the base64-encoded ACIR bytecode
    //    (UltraHonkBackend expects a string of base64, not the JSON object).
    ultraHonkBackend = new bbModule.UltraHonkBackend(circuitArtifact.bytecode);
  })();
  return initPromise;
}

/**
 * Compute the Poseidon BN254 commitment the circuit expects.
 *
 * The circuit uses noir-lang/poseidon v0.3.0. The Noir Poseidon oracle server
 * uses the same `poseidon-lite` implementation for Poseidon v1 hashing, so we
 * reuse that here to keep Step 01 fast and deterministic.
 */
async function computePoseidonCommitmentBN254(
  secret: number,
  value: bigint | number,
): Promise<bigint> {
  return poseidonHash2([BigInt(secret), toBigInt(value, "private value")]);
}

/**
 * Generate a real UltraHonk proof for the income/balance/credit circuit.
 */
export async function generateProof(inputs: ProverInputs): Promise<ProverOutput> {
  const t0 = performance.now();
  await ensureInit();
  const thresholdBigInt = toBigInt(inputs.threshold, "threshold");
  const privateValueBigInt = toBigInt(inputs.privateValue, "private value");

  // 1. Compute the Poseidon commitment the circuit expects.
  const commitment = await computePoseidonCommitmentBN254(
    inputs.dataSourceSecret,
    privateValueBigInt,
  );

  // 2. Build the full witness
  const ts = Math.floor(Date.now() / 1000);
  const attTypeNum =
    inputs.attestationType === "income"
      ? 1
      : inputs.attestationType === "balance"
        ? 2
        : 3;

  const noir = new noirModule.Noir(circuitArtifact);
  const { witness } = await noir.execute({
    monthly_income: privateValueBigInt.toString(),
    data_source_secret: String(inputs.dataSourceSecret),
    minimum_threshold: thresholdBigInt.toString(),
    attestation_type: String(attTypeNum),
    timestamp: String(ts),
    data_commitment: commitment.toString(),
  });

  // 3. Generate a keccak UltraHonk proof. The Soroban verifier and the upstream
  // bb CLI fixtures both use the keccak transcript; the default UltraHonk mode
  // verifies locally in bb.js but fails on-chain with SumcheckFailed.
  const proofData = await ultraHonkBackend.generateProof(witness, {
    keccak: true,
  });

  // 4. Package the 4 public inputs as 32-byte big-endian fields
  const publicInputs = new Uint8Array(128);
  writeField(publicInputs, 0, thresholdBigInt);
  writeField(publicInputs, 32, BigInt(attTypeNum));
  writeField(publicInputs, 64, BigInt(ts));
  writeField(publicInputs, 96, commitment);

  // 5. Serialize the proof bytes to hex for display.
  const proofBytes: Uint8Array =
    proofData.proof instanceof Uint8Array
      ? proofData.proof
      : new Uint8Array(proofData.proof);

  // 6. We do not need the VK for normal browser proving; the UI only needs the
  //    proof bytes + public inputs. VK extraction remains available through the
  //    dedicated getVerificationKey() helper for deploy/ops workflows.

  return {
    publicInputs,
    proof: proofBytes,
    proofHex: "0x" + bytesToHex(proofBytes),
    commitment,
    commitmentHex: "0x" + commitment.toString(16).padStart(64, "0"),
    vk: cachedVK ?? new Uint8Array(),
    timestamp: ts,
    durationMs: Math.round(performance.now() - t0),
  };
}

/** Get the on-chain VK (lazy-computed on first call). */
export async function getVerificationKey(): Promise<Uint8Array> {
  await ensureInit();
  if (!cachedVK) {
    const rawVk = await ultraHonkBackend.getVerificationKey({ keccak: true });
    cachedVK = normalizeVerificationKey(
      rawVk instanceof Uint8Array ? rawVk : new Uint8Array(rawVk),
    );
  }
  return cachedVK!;
}

/**
 * Derive the Poseidon commitment only — used by Step 1 of the UI so the user
 * can see the commitment before the (slow) proof generation.
 */
export async function computeCommitment(
  dataSourceSecret: number,
  value: bigint | number,
): Promise<string> {
  await ensureInit();
  const c = await computePoseidonCommitmentBN254(dataSourceSecret, value);
  return "0x" + c.toString(16).padStart(64, "0");
}

export async function debugGenerateProof(inputs: ProverInputs): Promise<Record<string, unknown>> {
  await ensureInit();
  const thresholdBigInt = toBigInt(inputs.threshold, "threshold");
  const privateValueBigInt = toBigInt(inputs.privateValue, "private value");
  const commitment = await computePoseidonCommitmentBN254(
    inputs.dataSourceSecret,
    privateValueBigInt,
  );
  const ts = Math.floor(Date.now() / 1000);
  const attTypeNum =
    inputs.attestationType === "income"
      ? 1
      : inputs.attestationType === "balance"
        ? 2
        : 3;

  const noir = new noirModule.Noir(circuitArtifact);
  const exec = await noir.execute({
    monthly_income: privateValueBigInt.toString(),
    data_source_secret: String(inputs.dataSourceSecret),
    minimum_threshold: thresholdBigInt.toString(),
    attestation_type: String(attTypeNum),
    timestamp: String(ts),
    data_commitment: commitment.toString(),
  });

  const proofData = await ultraHonkBackend.generateProof(exec.witness, {
    keccak: true,
  });

  return {
    commitment: commitment.toString(),
    witnessLength: exec.witness?.length ?? null,
    proofLength:
      proofData.proof instanceof Uint8Array
        ? proofData.proof.length
        : proofData.proof?.length ?? null,
  };
}

export async function debugWitnessOnly(inputs: ProverInputs): Promise<Record<string, unknown>> {
  await ensureInit();
  const thresholdBigInt = toBigInt(inputs.threshold, "threshold");
  const privateValueBigInt = toBigInt(inputs.privateValue, "private value");
  const commitment = await computePoseidonCommitmentBN254(
    inputs.dataSourceSecret,
    privateValueBigInt,
  );
  const ts = Math.floor(Date.now() / 1000);
  const attTypeNum =
    inputs.attestationType === "income"
      ? 1
      : inputs.attestationType === "balance"
        ? 2
        : 3;

  const noir = new noirModule.Noir(circuitArtifact);
  const exec = await noir.execute({
    monthly_income: privateValueBigInt.toString(),
    data_source_secret: String(inputs.dataSourceSecret),
    minimum_threshold: thresholdBigInt.toString(),
    attestation_type: String(attTypeNum),
    timestamp: String(ts),
    data_commitment: commitment.toString(),
  });

  return {
    commitment: commitment.toString(),
    witnessLength: exec.witness?.length ?? null,
    returnValue: exec.returnValue ?? null,
  };
}

export async function debugVerificationKey(): Promise<Record<string, unknown>> {
  await ensureInit();
  const backend = new bbModule.UltraHonkBackend(circuitArtifact.bytecode);
  const vk = await backend.getVerificationKey({ keccak: true });
  const normalizedVk = normalizeVerificationKey(
    vk instanceof Uint8Array ? vk : new Uint8Array(vk),
  );
  return { vkLength: vk.length, normalizedVkLength: normalizedVk.length };
}

function normalizeVerificationKey(vk: Uint8Array): Uint8Array {
  // bb.js v0.87 layout reference:
  //   getVerificationKey({ keccak: true }) -> 1760 bytes (clean VK)
  //   getVerificationKey()                -> 1764 bytes (header + 4 padding + body)
  // The Soroban Nethermind verifier expects the 1760-byte keccak VK directly.
  // Earlier code trimmed the last 4 bytes of the default VK and assumed that
  // produced a clean layout; in bb.js 0.87 the 4 extra bytes are a padding word
  // inserted RIGHT AFTER the 32-byte header, so trimming the tail instead leaves
  // garbage in every G1 point. We always fetch the keccak VK now, which is
  // already the correct 1760 bytes — so this function is effectively a pass-through
  // with a defensive length check.
  if (vk.length === EXPECTED_ONCHAIN_VK_BYTES) {
    return vk;
  }
  throw new Error(
    `Unexpected verification key length: ${vk.length} bytes ` +
      `(expected ${EXPECTED_ONCHAIN_VK_BYTES}). ` +
      `Did you forget { keccak: true } when calling getVerificationKey()?`,
  );
}

function toBigInt(value: bigint | number, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer before proof generation.`);
  }
  return BigInt(value);
}

function writeField(buf: Uint8Array, offset: number, value: bigint): void {
  const normalized = value.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) {
    buf[offset + i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
