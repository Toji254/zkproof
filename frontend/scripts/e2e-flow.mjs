import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { poseidon2 as poseidonHash2 } from 'poseidon-lite';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const FRONTEND_DIR = path.resolve(ROOT_DIR, 'frontend');
const CONTRACT_ID_FILE = path.resolve(ROOT_DIR, '.contract-id');
const CARGO_BIN = '/home/lowkey/.cargo/bin';

const EXPECTED_ONCHAIN_VK_BYTES = 1760;
const HAPPY_PRIVATE_VALUE = 5000n;
const HAPPY_THRESHOLD = 3000n;
const FAILURE_PRIVATE_VALUE = 2500n;
const FAILURE_THRESHOLD = 3000n;
const DATA_SOURCE_SECRET = 42424242;

function run(command, args, options = {}) {
  const res = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: options.cwd ?? ROOT_DIR,
    env: {
      ...process.env,
      PATH: `${CARGO_BIN}:${process.env.PATH ?? ''}`,
    },
    maxBuffer: 50 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const stderr = (res.stderr ?? '').trim();
    const stdout = (res.stdout ?? '').trim();
    throw new Error(
      `${command} ${args.join(' ')} failed (${res.status})\n${stdout ? `stdout:\n${stdout}\n` : ''}${stderr ? `stderr:\n${stderr}\n` : ''}`,
    );
  }
  return {
    stdout: (res.stdout ?? '').trim(),
    stderr: (res.stderr ?? '').trim(),
  };
}

function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function writeField(buf, offset, value) {
  const hex = value.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i += 1) {
    buf[offset + i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
}

function toBigInt(value, label) {
  if (typeof value === 'bigint') return value;
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer before proof generation.`);
  }
  return BigInt(value);
}

async function generateProof({ attestationType, threshold, privateValue, dataSourceSecret }) {
  const circuitPath = path.resolve(FRONTEND_DIR, 'public/zkproof.json');
  if (!fs.existsSync(circuitPath)) {
    throw new Error(`Missing circuit artifact at ${circuitPath}. Run ./scripts/build.sh first.`);
  }

  const circuitArtifact = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
  if (!circuitArtifact.bytecode) {
    throw new Error('Circuit artifact missing bytecode. Re-run nargo compile.');
  }

  const backend = new UltraHonkBackend(circuitArtifact.bytecode);
  const thresholdBigInt = toBigInt(threshold, 'threshold');
  const privateValueBigInt = toBigInt(privateValue, 'private value');
  const commitment = poseidonHash2([BigInt(dataSourceSecret), privateValueBigInt]);
  const timestamp = Math.floor(Date.now() / 1000);
  const attTypeNum = attestationType === 'income' ? 1 : attestationType === 'balance' ? 2 : 3;

  const noir = new Noir(circuitArtifact);
  const { witness } = await noir.execute({
    monthly_income: privateValueBigInt.toString(),
    data_source_secret: String(dataSourceSecret),
    minimum_threshold: thresholdBigInt.toString(),
    attestation_type: String(attTypeNum),
    timestamp: String(timestamp),
    data_commitment: commitment.toString(),
  });

  const proofData = await backend.generateProof(witness, { keccak: true });
  const proofBytes = proofData.proof instanceof Uint8Array ? proofData.proof : new Uint8Array(proofData.proof);
  if (proofBytes.length !== 14592) {
    throw new Error(`Unexpected proof length ${proofBytes.length} (expected 14592).`);
  }

  const publicInputs = new Uint8Array(128);
  writeField(publicInputs, 0, thresholdBigInt);
  writeField(publicInputs, 32, BigInt(attTypeNum));
  writeField(publicInputs, 64, BigInt(timestamp));
  writeField(publicInputs, 96, commitment);

  const vk = await backend.getVerificationKey({ keccak: true });
  if ((vk instanceof Uint8Array ? vk : new Uint8Array(vk)).length !== EXPECTED_ONCHAIN_VK_BYTES) {
    throw new Error('Unexpected VK length while generating happy-path proof.');
  }

  return {
    timestamp,
    commitment,
    publicInputsHex: bytesToHex(publicInputs),
    proofHex: bytesToHex(proofBytes),
    proofBytes,
  };
}

async function invokeContract(args, { retries = 3, retryDelayMs = 4000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = run('stellar', args, { cwd: ROOT_DIR });
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      console.log(combined || '(no output)');
      return combined;
    } catch (error) {
      const message = error?.message ?? String(error);
      const isSeqError = /TxBadSeq/.test(message);
      if (!isSeqError || attempt === retries) {
        throw error;
      }
      console.log(`Retrying contract invoke after TxBadSeq (attempt ${attempt}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error('unreachable');
}

function extractAttestationStatus(output) {
  if (/\bnull\b/.test(output)) return 'null';
  if (/"attestation_type"/.test(output) || /holder/.test(output)) return 'present';
  return 'unknown';
}

async function main() {
  if (!fs.existsSync(CONTRACT_ID_FILE)) {
    throw new Error('Missing .contract-id. Run ./scripts/deploy.sh first.');
  }

  const contractId = fs.readFileSync(CONTRACT_ID_FILE, 'utf8').trim();
  const userAddress = run('stellar', ['keys', 'address', 'zkproof_dev']).stdout.trim();
  console.log(`Contract: ${contractId}`);
  console.log(`Identity: ${userAddress}`);

  console.log('\n==> Happy path: browser proof -> on-chain attestation');
  const happy = await generateProof({
    attestationType: 'income',
    threshold: HAPPY_THRESHOLD,
    privateValue: HAPPY_PRIVATE_VALUE,
    dataSourceSecret: DATA_SOURCE_SECRET,
  });
  console.log(`Generated proof: ${happy.proofBytes.length} bytes`);
  console.log(`Public inputs: ${happy.publicInputsHex.length / 2} bytes`);

  const attestOutput = await invokeContract([
    'contract',
    'invoke',
    '--id', contractId,
    '--source-account', 'zkproof_dev',
    '--network', 'testnet',
    '--send', 'yes',
    '--',
    'attest',
    '--user', userAddress,
    '--public_inputs', happy.publicInputsHex,
    '--proof', happy.proofHex,
    '--attestation_type', 'income',
    '--threshold', String(HAPPY_THRESHOLD),
  ]);
  if (!/\btrue\b/.test(attestOutput)) {
    throw new Error('Happy-path attest() did not return true.');
  }

  const attestationOutput = await invokeContract([
    'contract',
    'invoke',
    '--id', contractId,
    '--source-account', 'zkproof_dev',
    '--network', 'testnet',
    '--',
    'get_attestation',
    '--address', userAddress,
    '--attestation_type', 'income',
  ]);
  if (extractAttestationStatus(attestationOutput) !== 'present') {
    throw new Error('Happy-path attestation was not readable after submit.');
  }

  console.log('\n==> Failure path: below-threshold proof generation');
  let thresholdRejected = false;
  try {
    await generateProof({
      attestationType: 'income',
      threshold: FAILURE_THRESHOLD,
      privateValue: FAILURE_PRIVATE_VALUE,
      dataSourceSecret: DATA_SOURCE_SECRET,
    });
  } catch (error) {
    thresholdRejected = true;
    console.log(`Below-threshold proof generation failed as expected: ${error?.message ?? String(error)}`);
  }
  if (!thresholdRejected) {
    throw new Error('Below-threshold proof generation unexpectedly succeeded.');
  }

  console.log('\n==> Failure path: malformed proof is rejected on-chain without recording state');
  const malformedProof = '00'.repeat(10);
  const malformedOutput = await invokeContract([
    'contract',
    'invoke',
    '--id', contractId,
    '--source-account', 'zkproof_dev',
    '--network', 'testnet',
    '--send', 'no',
    '--',
    'attest',
    '--user', userAddress,
    '--public_inputs', happy.publicInputsHex,
    '--proof', malformedProof,
    '--attestation_type', 'credit',
    '--threshold', String(HAPPY_THRESHOLD),
  ]);
  if (!/\bfalse\b/.test(malformedOutput)) {
    throw new Error('Malformed proof did not get rejected by attest().');
  }

  const malformedAttestation = await invokeContract([
    'contract',
    'invoke',
    '--id', contractId,
    '--source-account', 'zkproof_dev',
    '--network', 'testnet',
    '--',
    'get_attestation',
    '--address', userAddress,
    '--attestation_type', 'credit',
  ]);
  if (extractAttestationStatus(malformedAttestation) !== 'null') {
    throw new Error('Malformed proof unexpectedly recorded an attestation.');
  }

  console.log('\n✅ Full flow passed: browser-style proof generation, on-chain verification, attestation storage, and below-threshold rejection are all working.');
}

main().catch((error) => {
  console.error('\n❌ E2E flow failed');
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exit(1);
});
