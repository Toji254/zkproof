import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPECTED_ONCHAIN_VK_BYTES = 1760;

const circuitPath = path.join(__dirname, '../public/zkproof.json');
if (!fs.existsSync(circuitPath)) {
  console.error(`❌ Circuit file not found at ${circuitPath}. Make sure to build the circuits first.`);
  process.exit(1);
}

const circuit = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));

console.log("Importing @aztec/bb.js...");
const bb = await import('@aztec/bb.js');
const { UltraHonkBackend } = bb;

console.log("Instantiating UltraHonkBackend with bytecode length:", circuit.bytecode.length);
const backend = new UltraHonkBackend(circuit.bytecode);

try {
  console.log("Generating keccak verification key...");
  // bb.js v0.87.0 changed the VK byte layout:
  //   - getVerificationKey({ keccak: true }) returns 1760 bytes — header(32) || body(1728).
  //   - getVerificationKey() (default) returns 1764 bytes — header(32) || pad(4) || body(1728).
  // The on-chain Nethermind verifier expects 1760 bytes with the header followed
  // directly by 27 G1 points. So we MUST use the keccak variant — trimming the
  // trailing 4 bytes from the default VK leaves the 4-byte padding inserted
  // between header and body, which corrupts every G1 point and produces
  // `bn254: unable to deserialize bn254 Fp` during on-chain verification.
  const rawVk = await backend.getVerificationKey({ keccak: true });
  if (rawVk.length !== EXPECTED_ONCHAIN_VK_BYTES) {
    throw new Error(
      `Unexpected keccak VK length: ${rawVk.length} bytes ` +
        `(expected ${EXPECTED_ONCHAIN_VK_BYTES}). ` +
        `This usually means @aztec/bb.js changed its VK layout; regenerate with the matching version.`,
    );
  }
  const vk = rawVk;

  const targetDir = path.join(__dirname, '../../circuits/target');
  // The previous layout put `vk.bin` as a file, then a later change made it a
  // directory containing `vk`. Remove both shapes before writing so the layout
  // is always the file (which is what the rest of the repo expects).
  const targetPath = path.join(targetDir, 'vk.bin');
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }
  fs.writeFileSync(targetPath, vk);

  console.log(`✅ Verification key successfully generated and written to ${targetPath} (${vk.length} bytes)`);
} catch (err) {
  console.error("❌ Error generating verification key:", err);
  process.exit(1);
} finally {
  // If bb.js uses worker pools, it might hold the event loop. Let's try to destroy or force exit.
  if (backend && typeof backend.destroy === 'function') {
    await backend.destroy();
  }
  process.exit(0);
}