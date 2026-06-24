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

export interface ProverInputs {
  attestationType: "income" | "balance" | "credit";
  threshold: number; // u64
  privateValue: number; // the secret (e.g. income / balance / credit score)
  dataSourceSecret: number; // field element used in the commitment
}

export interface ProverOutput {
  publicInputs: Uint8Array; // 128 bytes (4 × 32-byte Field)
  proof: Uint8Array; // ~14,592 bytes
  proofHex: string; // 0x-prefixed hex for display
  commitment: bigint; // the Poseidon commitment as a Field integer
  commitmentHex: string;
  vk: Uint8Array; // 1760-byte on-chain verification key
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
 * The circuit uses `poseidon::poseidon::bn254::hash_2([secret, value])` from
 * the noir-lang/poseidon crate (v0.3.0). bb.js v0.87.0 exposes the same
 * hash via `BarretenbergSync.poseidon2Hash` — but poseidon (v1) is what the
 * circuit uses, not poseidon2. bb.js v0.87 does NOT export a `poseidonHash`
 * helper, so we execute the circuit itself to derive the commitment.
 *
 * This executes the witness twice (once for the commitment, once for the
 * final proof) but is the only way to guarantee field-arithmetic parity
 * with the circuit. For a small 1-constraint circuit like ours, the
 * overhead is sub-second.
 */
async function computePoseidonCommitmentBN254(
  secret: number,
  value: number,
): Promise<bigint> {
  const ts = Math.floor(Date.now() / 1000);
  // We need the noir context to execute. The Noir constructor only
  // needs the circuit artifact (no backend).
  const noir = new noirModule.Noir(circuitArtifact);
  const { returnValue } = await noir.execute({
    monthly_income: String(value),
    data_source_secret: String(secret),
    minimum_threshold: "0", // doesn't matter for commitment extraction
    attestation_type: "1",
    timestamp: String(ts),
    data_commitment: "0", // dummy; circuit re-derives and asserts
  });
  // The returnValue is the commitment field element.
  if (typeof returnValue === "string") return BigInt(returnValue);
  if (Array.isArray(returnValue)) {
    // Some Noir versions return the public inputs as an array
    return BigInt(returnValue[3] ?? returnValue[0]);
  }
  if (returnValue && typeof returnValue === "object") {
    return BigInt(returnValue[3] ?? returnValue[0] ?? "0");
  }
  throw new Error("Unexpected Noir returnValue shape: " + JSON.stringify(returnValue));
}

/**
 * Generate a real UltraHonk proof for the income/balance/credit circuit.
 */
export async function generateProof(inputs: ProverInputs): Promise<ProverOutput> {
  const t0 = performance.now();
  await ensureInit();

  // 1. Poseidon commitment — execute the circuit with a dummy commitment
  //    (the circuit re-derives the commitment and asserts it matches the
  //    public input — so we pass 0 and read it back from the result).
  const commitment = await computePoseidonCommitmentBN254(
    inputs.dataSourceSecret,
    inputs.privateValue,
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
    monthly_income: String(inputs.privateValue),
    data_source_secret: String(inputs.dataSourceSecret),
    minimum_threshold: String(inputs.threshold),
    attestation_type: String(attTypeNum),
    timestamp: String(ts),
    data_commitment: commitment.toString(),
  });

  // 3. Generate the UltraHonk proof
  const proofData = await ultraHonkBackend.generateProof(witness);

  // 4. Package the 4 public inputs as 32-byte big-endian fields
  const publicInputs = new Uint8Array(128);
  writeFieldU64(publicInputs, 0, BigInt(inputs.threshold));
  writeFieldU64(publicInputs, 32, BigInt(attTypeNum));
  writeFieldU64(publicInputs, 64, BigInt(ts));
  writeFieldU32(publicInputs, 96, commitment);

  // 5. The proof is in proofData.proof (a Uint8Array). Serialize to hex
  //    for display.
  const proofBytes: Uint8Array =
    proofData.proof instanceof Uint8Array
      ? proofData.proof
      : new Uint8Array(proofData.proof);

  // 6. Lazily compute the on-chain VK the first time it's needed. The VK is
  //    1760 bytes (the exact format the Soroban verifier expects).
  if (!cachedVK) {
    cachedVK = await ultraHonkBackend.getVerificationKey();
  }

  return {
    publicInputs,
    proof: proofBytes,
    proofHex: "0x" + bytesToHex(proofBytes),
    commitment,
    commitmentHex: "0x" + commitment.toString(16).padStart(64, "0"),
    vk: cachedVK!, // cachedVK is assigned just above — guaranteed non-null at this point
    durationMs: Math.round(performance.now() - t0),
  };
}

/** Get the on-chain VK (lazy-computed on first call). */
export async function getVerificationKey(): Promise<Uint8Array> {
  await ensureInit();
  if (!cachedVK) {
    cachedVK = await ultraHonkBackend.getVerificationKey();
  }
  return cachedVK!;
}

/**
 * Derive the Poseidon commitment only — used by Step 1 of the UI so the user
 * can see the commitment before the (slow) proof generation.
 */
export async function computeCommitment(
  dataSourceSecret: number,
  value: number,
): Promise<string> {
  await ensureInit();
  const c = await computePoseidonCommitmentBN254(dataSourceSecret, value);
  return "0x" + c.toString(16).padStart(64, "0");
}

function writeFieldU64(buf: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 32);
  view.setBigUint64(24, value, false /* big-endian */);
}

function writeFieldU32(buf: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 32);
  view.setUint32(28, Number(value & 0xffffffffn), false);
  view.setUint32(24, Number((value >> 32n) & 0xffffffffn), false);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
