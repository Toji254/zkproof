import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  console.log("Generating verification key...");
  const vk = await backend.getVerificationKey();

  const targetDir = path.join(__dirname, '../../circuits/target');
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, 'vk.bin');
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
