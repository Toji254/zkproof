import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';
import { 
  rpc, 
  Contract, 
  TransactionBuilder, 
  nativeToScVal, 
  scValToNative, 
  Account, 
  xdr,
  BASE_FEE
} from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK, NETWORK_PASSPHRASE, RPC_URL } from './config';

/**
 * Pads a value to 32 bytes big-endian (u64 / i128 compatible)
 * @param {number|bigint} value 
 * @returns {Uint8Array}
 */
function padTo32Bytes(value) {
  const bytes = new Uint8Array(32);
  const bigIntValue = BigInt(value);
  for (let i = 0; i < 8; i++) {
    bytes[31 - i] = Number((bigIntValue >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

/**
 * Connect to Freighter and return public key.
 * Handles cases where Freighter is not installed by showing install page.
 * @returns {Promise<string>} Public key
 */
export async function connectWallet() {
  const isInstalled = typeof window !== 'undefined' && (!!window.freighterApi || !!window.stellarKeeper);
  
  if (!isInstalled) {
    if (typeof window !== 'undefined') {
      window.open('https://www.freighter.app/', '_blank');
    }
    throw new Error('Freighter wallet is not installed. Redirecting to installation page...');
  }

  try {
    const connected = await isConnected();
    if (!connected) {
      console.log('Freighter not yet connected. Requesting permissions.');
    }
    
    const publicKey = await getPublicKey();
    if (!publicKey) {
      throw new Error('Please unlock your Freighter wallet and try again.');
    }
    return publicKey;
  } catch (error) {
    console.error('Freighter connection error:', error);
    throw new Error(error.message || 'Failed to connect Freighter wallet.');
  }
}

/**
 * Disconnect wallet helper.
 * @returns {boolean}
 */
export function disconnectWallet() {
  console.log('Freighter wallet disconnected.');
  return true;
}

/**
 * Builds, simulates, signs via Freighter, and submits a Soroban transaction to attest().
 * @param {string|Uint8Array} proof - The proof bytes or hex string
 * @param {any[]} publicInputs - ZK public inputs array
 * @param {string} attestationType - "income", "balance", "credit"
 * @param {number|string} threshold - Threshold proven
 * @returns {Promise<string>} The transaction hash
 */
export async function submitAttestation(proof, publicInputs, attestationType, threshold) {
  if (!CONTRACT_ID) {
    throw new Error('zkProof contract ID is not configured in config.js.');
  }

  const server = new rpc.Server(RPC_URL);
  
  // 1. Get user public key
  const userAddress = await connectWallet();
  console.log('Fetching account info for:', userAddress);
  const sourceAccount = await server.getAccount(userAddress);

  // 2. Prepare proof inputs and format proof bytes
  let attTypeVal = 1n; // income
  if (attestationType === 'balance') attTypeVal = 2n;
  else if (attestationType === 'credit') attTypeVal = 3n;

  const nowVal = BigInt(Math.floor(Date.now() / 1000));
  
  // data_commitment: extract from publicInputs if available
  let commitmentBytes = new Uint8Array(32);
  if (publicInputs && publicInputs[3]) {
    if (typeof publicInputs[3] === 'string') {
      const cleanHex = publicInputs[3].startsWith('0x') ? publicInputs[3].slice(2) : publicInputs[3];
      commitmentBytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } else if (publicInputs[3] instanceof Uint8Array) {
      commitmentBytes = publicInputs[3];
    }
  }

  // Build the 128 bytes header: [threshold, attestation_type, timestamp, data_commitment]
  const p1 = padTo32Bytes(threshold);
  const p2 = padTo32Bytes(attTypeVal);
  const p3 = padTo32Bytes(nowVal);
  const p4 = commitmentBytes;

  const header = new Uint8Array(128);
  header.set(p1, 0);
  header.set(p2, 32);
  header.set(p3, 64);
  header.set(p4, 96);

  let rawProofBytes;
  if (typeof proof === 'string') {
    const cleanHex = proof.startsWith('0x') ? proof.slice(2) : proof;
    rawProofBytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  } else if (proof instanceof Uint8Array) {
    rawProofBytes = proof;
  } else {
    rawProofBytes = new Uint8Array(96); // Fallback / dummy
  }

  // Concatenate header and proof
  const finalProofBytes = new Uint8Array(header.length + rawProofBytes.length);
  finalProofBytes.set(header, 0);
  finalProofBytes.set(rawProofBytes, header.length);

  const contract = new Contract(CONTRACT_ID);

  console.log('Building transaction for contract call attest()...');
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  .appendOperation(
    contract.call(
      'attest',
      nativeToScVal(userAddress, { type: 'address' }),
      nativeToScVal(finalProofBytes, { type: 'bytes' }),
      nativeToScVal(attestationType, { type: 'symbol' }),
      nativeToScVal(BigInt(threshold), { type: 'i128' })
    )
  )
  .setTimeout(30)
  .build();

  // 3. Simulate and prepare transaction
  console.log('Simulating transaction on-chain...');
  let preparedTx;
  try {
    preparedTx = await server.prepareTransaction(tx);
  } catch (err) {
    console.error('Transaction simulation failed:', err);
    throw new Error('On-chain simulation failed. Please ensure the inputs and proof are valid.');
  }

  // 4. Sign via Freighter
  console.log('Requesting signature from Freighter...');
  let signResult;
  try {
    signResult = await signTransaction(preparedTx.toXDR(), { network: NETWORK });
  } catch (err) {
    console.error('Freighter signing failed:', err);
    throw new Error('Freighter transaction signing failed or was rejected.');
  }

  const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr || signResult;
  if (!signedXdr) {
    throw new Error('Transaction signing was cancelled.');
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // 5. Submit to network
  console.log('Submitting signed transaction...');
  const sendResponse = await server.sendTransaction(signedTx);
  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction submission error: ${JSON.stringify(sendResponse.errorResult)}`);
  }

  // 6. Poll for transaction status
  console.log('Polling for transaction status (hash:', sendResponse.hash, ')...');
  const finalStatus = await server.pollTransaction(sendResponse.hash);
  if (finalStatus.status !== 'SUCCESS') {
    throw new Error(`Transaction failed on-chain with status: ${finalStatus.status}`);
  }

  console.log('Transaction succeeded!');
  return sendResponse.hash;
}

/**
 * Checks if an address holds a valid attestation.
 * @param {string} address - Stellar address to check
 * @param {string} attestationType - "income", "balance", "credit"
 * @returns {Promise<{ valid: boolean, attestation: object|null }>}
 */
export async function checkAttestation(address, attestationType) {
  if (!CONTRACT_ID) {
    throw new Error('CONTRACT_ID is not configured in config.js.');
  }

  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '0');

  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  .appendOperation(
    contract.call(
      'check',
      nativeToScVal(address, { type: 'address' }),
      nativeToScVal(attestationType, { type: 'symbol' })
    )
  )
  .setTimeout(30)
  .build();

  console.log('Simulating read-only check()...');
  const simulation = await server.simulateTransaction(tx);
  if (simulation.error || simulation.resultError) {
    throw new Error(`Read query failed: ${simulation.error || simulation.resultError}`);
  }

  const result = simulation.results?.[0];
  if (!result || !result.xdr) {
    return { valid: false, attestation: null };
  }

  const scVal = xdr.ScVal.fromXDR(result.xdr, 'base64');
  const valid = scValToNative(scVal);

  let attestation = null;
  if (valid) {
    try {
      attestation = await getAttestationDetails(address, attestationType);
    } catch (err) {
      console.error('Failed to retrieve attestation details:', err);
    }
  }

  return { valid, attestation };
}

/**
 * Gets the detailed attestation for a given address and type.
 * @param {string} address 
 * @param {string} attestationType 
 * @returns {Promise<object|null>} The decoded attestation details or null
 */
export async function getAttestationDetails(address, attestationType) {
  if (!CONTRACT_ID) {
    throw new Error('CONTRACT_ID is not configured in config.js.');
  }

  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '0');

  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  .appendOperation(
    contract.call(
      'get_attestation',
      nativeToScVal(address, { type: 'address' }),
      nativeToScVal(attestationType, { type: 'symbol' })
    )
  )
  .setTimeout(30)
  .build();

  console.log('Simulating read-only get_attestation()...');
  const simulation = await server.simulateTransaction(tx);
  if (simulation.error || simulation.resultError) {
    throw new Error(`Read query failed: ${simulation.error || simulation.resultError}`);
  }

  const result = simulation.results?.[0];
  if (!result || !result.xdr) {
    return null;
  }

  const scVal = xdr.ScVal.fromXDR(result.xdr, 'base64');
  const nativeVal = scValToNative(scVal);
  if (!nativeVal) {
    return null;
  }

  // Format values for Javascript usage
  return {
    holder: nativeVal.holder,
    attestationType: typeof nativeVal.attestation_type === 'object' ? nativeVal.attestation_type.toString() : nativeVal.attestation_type,
    threshold: Number(nativeVal.threshold),
    issuedAt: Number(nativeVal.issued_at),
    expiresAt: Number(nativeVal.expires_at),
    proofHash: nativeVal.proof_hash instanceof Uint8Array ? 
      '0x' + Array.from(nativeVal.proof_hash, b => b.toString(16).padStart(2, '0')).join('') : 
      nativeVal.proof_hash,
  };
}
