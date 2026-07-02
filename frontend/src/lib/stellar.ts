import { signWithKit } from "./wallets";
import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  nativeToScVal,
  scValToNative,
  xdr,
  BASE_FEE,
  Keypair,
} from "@stellar/stellar-sdk";
import { CONTRACT_ID, HORIZON_URL, NETWORK_PASSPHRASE, RPC_URL } from "./config";

// allowHttp: true is required when the URL is a local proxy path (http://)
// rather than a direct https:// endpoint. Safe in production because
// RPC_URL is always https:// outside localhost.
function makeServer(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: true });
}

// The Stellar SDK v12 types are strict (union types for results); to keep
// this module readable, we cast through `any` at the boundary and reason
// about runtime shapes in the function bodies.
type Any = any;

type RawRpcTransactionStatus = "NOT_FOUND" | "SUCCESS" | "FAILED" | string;

interface RawRpcTransactionResponse {
  status: RawRpcTransactionStatus;
  resultXdr?: string;
  resultMetaXdr?: string;
  envelopeXdr?: string;
  diagnosticEventsXdr?: string[];
  txHash?: string;
}

let connectedAddress: string | null = null;
const CONNECTED_ADDRESS_STORAGE_KEY = 'zkproof_connected_wallet_address';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSendTransactionError(sendResponse: Any): string {
  const txCode = getSendTransactionResultCode(sendResponse);
  const details: string[] = [];

  if (sendResponse?.status) {
    details.push(`status=${sendResponse.status}`);
  }

  if (txCode) {
    details.push(`txCode=${txCode}`);
  }

  try {
    const result = sendResponse?.errorResult?.result?.();
    if (result) {
      const switchName = typeof result?.switch === "function" ? result.switch()?.name : null;
      if (switchName && switchName !== txCode) {
        details.push(`result=${switchName}`);
      } else if (!switchName) {
        details.push(`result=${String(result)}`);
      }
    }
  } catch {
    // Avoid masking the real send failure with XDR serialization issues.
  }

  if (Array.isArray(sendResponse?.diagnosticEvents) && sendResponse.diagnosticEvents.length > 0) {
    details.push(`diagnosticEvents=${sendResponse.diagnosticEvents.length}`);
  }

  return details.join(", ") || "unknown send failure";
}

function getSendTransactionResultCode(sendResponse: Any): string | null {
  try {
    const result = sendResponse?.errorResult?.result?.();
    const code = typeof result?.switch === "function" ? result.switch() : null;
    return typeof code?.name === "string" ? code.name : null;
  } catch {
    return null;
  }
}

function isRetryableSendTransactionError(sendResponse: Any): boolean {
  return getSendTransactionResultCode(sendResponse) === "txBadSeq";
}

async function rpcRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `zkproof-${method}-${Date.now()}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    result?: T;
  };

  if (payload.error) {
    throw new Error(
      payload.error.message || `RPC ${method} failed (${payload.error.code ?? "unknown error"}).`,
    );
  }

  if (!payload.result) {
    throw new Error(`RPC ${method} returned no result.`);
  }

  return payload.result;
}

function formatRawTransactionFailure(tx: RawRpcTransactionResponse): string {
  const details: string[] = [`status=${tx.status}`];

  if (tx.txHash) {
    details.push(`hash=${tx.txHash}`);
  }

  if (tx.diagnosticEventsXdr?.length) {
    details.push(`diagnosticEvents=${tx.diagnosticEventsXdr.length}`);
  }

  if (tx.resultXdr) {
    details.push("resultXdr=present");
  }

  return details.join(", ");
}

function decodeScValResult(resultXdr?: string): unknown | null {
  if (!resultXdr) return null;

  try {
    return scValToNative(xdr.ScVal.fromXDR(resultXdr, "base64"));
  } catch {
    return null;
  }
}

function decodeScValLike(value: unknown): unknown | null {
  if (!value) return null;

  try {
    if (typeof value === "string") {
      return decodeScValResult(value);
    }

    return scValToNative(value as xdr.ScVal);
  } catch {
    return null;
  }
}

function getSimulationReturnValue(simulation: Any): unknown | null {
  const retval = simulation?.result?.retval;
  if (retval) {
    return decodeScValLike(retval);
  }

  return decodeScValResult(simulation?.results?.[0]?.xdr);
}

function getTransactionReturnValue(tx: RawRpcTransactionResponse): unknown | null {
  for (const eventXdr of tx.diagnosticEventsXdr ?? []) {
    try {
      const event = xdr.DiagnosticEvent.fromXDR(eventXdr, "base64");
      const body = event.event().body().v0();
      const topics = body.topics();
      if (topics.length < 2) continue;

      const marker = scValToNative(topics[0]);
      if (marker !== "fn_return") continue;

      return decodeScValLike(body.data());
    } catch {
      // Ignore malformed diagnostic events and fall back to null below.
    }
  }

  return null;
}

function formatRejectedAttestationHint(): string {
  return (
    "The contract simulated a false result, so signing would not record an attestation. " +
    "This usually means proof verification failed, the deployed verification key is stale, " +
    "or the proof inputs no longer match the contract arguments. If you recently changed the " +
    "circuit or prover, re-upload the keccak verification key with ./scripts/update-vk.sh."
  );
}

async function waitForTransaction(
  server: Any,
  hash: string,
  timeoutMs = 30000,
): Promise<RawRpcTransactionResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let tx: RawRpcTransactionResponse;

    try {
      const sdkTx = await server.getTransaction(hash);
      tx = {
        status: sdkTx.status,
        resultXdr: sdkTx.resultXdr,
        resultMetaXdr: sdkTx.resultMetaXdr,
        envelopeXdr: sdkTx.envelopeXdr,
        diagnosticEventsXdr: sdkTx.diagnosticEventsXdr,
        txHash: hash,
      };
    } catch (err: Any) {
      const message = err?.message ?? String(err);
      if (!message.includes("Bad union switch")) {
        throw err;
      }

      tx = await rpcRequest<RawRpcTransactionResponse>("getTransaction", { hash });
    }

    if (tx.status !== "NOT_FOUND") {
      return tx;
    }

    await sleep(1200);
  }

  throw new Error(
    `Transaction is still pending after ${Math.round(timeoutMs / 1000)}s. ` +
      `Check the hash manually: ${hash}`,
  );
}

async function waitForRecordedAttestation(
  address: string,
  attestationType: string,
  attempts = 6,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { valid } = await checkAttestation(address, attestationType);
    if (valid) return true;

    if (attempt < attempts - 1) {
      await sleep(1200);
    }
  }

  return false;
}

export interface WalletAssetBalance {
  id: string;
  assetType: string;
  code: string;
  issuer: string | null;
  balance: string;
  numericBalance: number;
  label: string;
  isNative: boolean;
}

export interface VerificationKeyStatus {
  exists: boolean;
  byteLength: number;
  isPlaceholder: boolean;
  isExpectedLength: boolean;
  hexPreview: string;
}

interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonAccountResponse {
  balances?: HorizonBalanceLine[];
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${clean.length}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function mapHorizonBalance(line: HorizonBalanceLine): WalletAssetBalance {
  const isNative = line.asset_type === "native";
  const code = isNative ? "XLM" : line.asset_code || "UNKNOWN";
  const issuer = isNative ? null : line.asset_issuer || null;
  const label = issuer ? `${code} · ${issuer.slice(0, 4)}…${issuer.slice(-4)}` : code;
  const numericBalance = Number.parseFloat(line.balance);

  return {
    id: isNative ? "native:XLM" : `${code}:${issuer ?? "unknown"}`,
    assetType: line.asset_type,
    code,
    issuer,
    balance: line.balance,
    numericBalance: Number.isFinite(numericBalance) ? numericBalance : 0,
    label,
    isNative,
  };
}

export async function fetchWalletBalances(
  address: string,
): Promise<WalletAssetBalance[]> {
  if (!address) return [];

  const response = await fetch(
    `${HORIZON_URL}/accounts/${encodeURIComponent(address)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load wallet balances from Horizon (HTTP ${response.status}).`,
    );
  }

  const account = (await response.json()) as HorizonAccountResponse;
  const balances = (account.balances ?? [])
    .map(mapHorizonBalance)
    .filter((asset) => asset.numericBalance > 0);

  balances.sort((a, b) => {
    if (a.isNative !== b.isNative) return a.isNative ? -1 : 1;
    return b.numericBalance - a.numericBalance;
  });

  return balances;
}

/**
 * Build, simulate, sign (via connected wallet), submit, and confirm a
 * Soroban transaction that calls the contract's `attest` function.
 */
export async function submitAttestation(
  proofHex: string,
  publicInputs: string[] | null,
  attestationType: string,
  threshold: bigint | number | string,
  onSubmitted?: (hash: string) => void,
): Promise<string> {
  if (!CONTRACT_ID) {
    throw new Error(
      "zkProof contract ID is not configured. Set VITE_CONTRACT_ID in frontend/.env.",
    );
  }
  if (!connectedAddress) {
    throw new Error("No wallet connected. Open the wallet picker first.");
  }
  if (!publicInputs || publicInputs.length < 4) {
    throw new Error(
      "publicInputs must contain [threshold, att_type, timestamp, commitment]",
    );
  }

  const server: Any = makeServer();
  const maxSendAttempts = 2;

  // 1. Build the 4 × 32-byte public inputs bytes (circuit-scaled values).
  const thresholdValue = BigInt(String(publicInputs[0] ?? threshold));
  const attTypeNum =
    attestationType === "income"
      ? 1
      : attestationType === "balance"
        ? 2
        : attestationType === "credit"
          ? 3
          : 1;
  const timestampNum = Number(publicInputs[2]);
  const commitmentHex = publicInputs[3];

  const pubInputs = new Uint8Array(128);
  const dv = new DataView(pubInputs.buffer);
  dv.setBigUint64(24, thresholdValue, false);
  dv.setBigUint64(32 + 24, BigInt(attTypeNum), false);
  dv.setBigUint64(64 + 24, BigInt(timestampNum), false);
  const commitmentBytes = hexToBytes(commitmentHex);
  pubInputs.set(commitmentBytes.slice(0, 32), 96);

  // 2. Decode the proof.
  const proofBytes = hexToBytes(proofHex);
  if (proofBytes.length !== 14592) {
    throw new Error(
      `Invalid proof length: got ${proofBytes.length} bytes, expected 14,592. ` +
        `This means the prover returned a proof in a different format.`,
    );
  }

  // 3. Build the transaction.
  const contract = new Contract(CONTRACT_ID);

  // The contract cross-checks the i128 `threshold` arg against the first public
  // input. For balance proofs that value is already scaled to chain precision
  // (7 decimals for XLM), so using the raw human-readable string here causes
  // the attestation to be silently rejected on-chain. Reuse the exact public
  // input value to keep the contract arguments and proof inputs aligned.
  const contractThreshold = thresholdValue;

  for (let attempt = 1; attempt <= maxSendAttempts; attempt += 1) {
    const sourceAccount = await server.getAccount(connectedAddress);
    const tx: Any = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "attest",
          nativeToScVal(connectedAddress, { type: "address" }),
          nativeToScVal(pubInputs, { type: "bytes" }),
          nativeToScVal(proofBytes, { type: "bytes" }),
          nativeToScVal(attestationType, { type: "symbol" }),
          nativeToScVal(contractThreshold, { type: "i128" }),
        ),
      )
      .setTimeout(30)
      .build();

    const simulation: Any = await server.simulateTransaction(tx);
    if (simulation.error) {
      throw new Error(
        `On-chain simulation failed: ${simulation.error}. ` +
          `If this mentions verification or the VK, re-upload the keccak verification key with ./scripts/update-vk.sh.`,
      );
    }

    const simulatedResult = getSimulationReturnValue(simulation);
    if (simulatedResult === false) {
      throw new Error(formatRejectedAttestationHint());
    }

    // 4. Simulate before asking the user to sign.
    // We wrap this in a try/catch that pulls out a plain string error message.
    // The stellar-sdk sometimes throws a "Bad union switch: N" TypeError when it
    // fails to decode the XDR of a Soroban panic/error response, which masks the
    // real contract error. We guard against that here.
    let prepared: Any;
    try {
      prepared = await server.prepareTransaction(tx);
    } catch (err: Any) {
      console.error("Simulation failed:", err);
      // Pull a human-readable message from various error shapes the SDK may throw.
      let msg: string = err?.message ?? String(err);
      // If the SDK itself crashed parsing the error ("Bad union switch"),
      // try to surface the raw simulation error string instead.
      if (msg.includes('union switch') || msg.includes('Bad union')) {
        msg = 'Contract execution failed during simulation. ' +
          'Possible causes: VK mismatch (run ./scripts/update-vk.sh), ' +
          'invalid proof length, or circuit constraint violation.';
      }
      throw new Error(
        `On-chain simulation failed: ${msg}. ` +
          `If this says "verification failed" or "VK", the verification key ` +
          `on-chain does not match the circuit — run ./scripts/update-vk.sh.`,
      );
    }

    // 5. Sign via the connected wallet.
    const xdrToSign = prepared.toXDR();
    const signedTxXdr = await signWithKit(
      xdrToSign,
      connectedAddress,
      NETWORK_PASSPHRASE,
    );

    // 6. Submit + poll.
    let signedTx: Any;
    try {
      signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    } catch (err: Any) {
      throw new Error(
        `Failed to parse signed transaction XDR: ${err?.message ?? String(err)}. ` +
          `This usually means the wallet returned an unexpected object shape.`,
      );
    }

    const sendResponse = await server.sendTransaction(signedTx);
    if (sendResponse.status === "ERROR") {
      if (attempt < maxSendAttempts && isRetryableSendTransactionError(sendResponse)) {
        console.warn(
          `Retrying attestation after sendTransaction error (${formatSendTransactionError(sendResponse)}).`,
        );
        continue;
      }

      throw new Error(`Transaction submission error: ${formatSendTransactionError(sendResponse)}`);
    }

    onSubmitted?.(sendResponse.hash);
    const final = await waitForTransaction(server, sendResponse.hash);
    if (final.status !== "SUCCESS") {
      throw new Error(
        `Transaction failed on-chain: ${formatRawTransactionFailure(final)}`,
      );
    }

    const finalResult = getTransactionReturnValue(final);
    if (finalResult === false) {
      throw new Error(`${formatRejectedAttestationHint()} Transaction hash: ${sendResponse.hash}`);
    }

    const valid = await waitForRecordedAttestation(connectedAddress, attestationType);
    if (!valid) {
      throw new Error(
        "Transaction confirmed, but the attestation was still not visible after several read retries. " +
          `Check the tx on Stellar Expert and verify the contract state directly. Tx hash: ${sendResponse.hash}`,
      );
    }

    return sendResponse.hash;
  }

  throw new Error("Transaction submission failed after retrying with a fresh account sequence.");
}

/** Read-only: does the given address have a non-expired attestation of this type? */
export async function checkAttestation(
  address: string,
  attestationType: string,
): Promise<{ valid: boolean; attestation: any | null }> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID is not configured.");

  const server: Any = makeServer();
  const contract = new Contract(CONTRACT_ID);
  const dummy = Keypair.random();
  const account = new Account(dummy.publicKey(), "0");

  const tx: Any = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "check",
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(attestationType, { type: "symbol" }),
      ),
    )
    .setTimeout(30)
    .build();

  const simulation: Any = await server.simulateTransaction(tx);
  if (simulation.error) {
    throw new Error(`Read query failed: ${simulation.error}`);
  }
  const valid = getSimulationReturnValue(simulation);
  if (typeof valid !== "boolean") {
    return { valid: false, attestation: null };
  }

  let attestation = null;
  if (valid) {
    try {
      attestation = await getAttestationDetails(address, attestationType);
    } catch (err) {
      console.error("Failed to retrieve attestation details:", err);
    }
  }
  return { valid, attestation };
}

export async function getAttestationDetails(
  address: string,
  attestationType: string,
): Promise<any | null> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID is not configured.");

  const server: Any = makeServer();
  const contract = new Contract(CONTRACT_ID);
  const dummy = Keypair.random();
  const account = new Account(dummy.publicKey(), "0");

  const tx: Any = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "get_attestation",
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(attestationType, { type: "symbol" }),
      ),
    )
    .setTimeout(30)
    .build();

  const simulation: Any = await server.simulateTransaction(tx);
  if (simulation.error) {
    throw new Error(`Read query failed: ${simulation.error}`);
  }
  const nativeVal = getSimulationReturnValue(simulation) as
    | {
        holder: string;
        attestation_type: { toString(): string } | string;
        threshold: bigint | number | string;
        issued_at: bigint | number | string;
        expires_at: bigint | number | string;
        proof_hash: Uint8Array | string;
      }
    | null;
  if (!nativeVal) return null;

  return {
    holder: nativeVal.holder,
    attestationType:
      typeof nativeVal.attestation_type === "object"
        ? nativeVal.attestation_type.toString()
        : nativeVal.attestation_type,
    threshold: Number(nativeVal.threshold),
    issuedAt: Number(nativeVal.issued_at),
    expiresAt: Number(nativeVal.expires_at),
    proofHash:
      nativeVal.proof_hash instanceof Uint8Array
        ? "0x" +
          Array.from(nativeVal.proof_hash, (b: number) =>
            b.toString(16).padStart(2, "0"),
          ).join("")
        : nativeVal.proof_hash,
  };
}

export async function getVerificationKeyStatus(): Promise<VerificationKeyStatus> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID is not configured.");
  const EXPECTED_VK_BYTES = 1760;

  const server: Any = makeServer();
  const contract = new Contract(CONTRACT_ID);
  const dummy = Keypair.random();
  const account = new Account(dummy.publicKey(), "0");

  const tx: Any = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_verification_key"))
    .setTimeout(30)
    .build();

  const simulation: Any = await server.simulateTransaction(tx);
  if (simulation.error) {
    throw new Error(`Verification key query failed: ${simulation.error}`);
  }
  const nativeVal = getSimulationReturnValue(simulation) as Uint8Array | null;
  if (!nativeVal || !(nativeVal instanceof Uint8Array)) {
    return { exists: false, byteLength: 0, isPlaceholder: false, isExpectedLength: false, hexPreview: "" };
  }

  const byteLength = nativeVal.length;
  const hexPreview =
    "0x" +
    Array.from(nativeVal.slice(0, Math.min(16, nativeVal.length)), (b: number) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const isPlaceholder =
    byteLength > 0 && Array.from(nativeVal).every((b: number) => b === 0);
  const isExpectedLength = byteLength === EXPECTED_VK_BYTES;

  return {
    exists: true,
    byteLength,
    isPlaceholder,
    isExpectedLength,
    hexPreview,
  };
}

// The WalletPicker module calls these to keep the address in sync.
export function setConnectedAddress(addr: string | null): void {
  connectedAddress = addr;
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

  if (addr) {
    window.localStorage.setItem(CONNECTED_ADDRESS_STORAGE_KEY, addr);
  } else {
    window.localStorage.removeItem(CONNECTED_ADDRESS_STORAGE_KEY);
  }
}
export function getConnectedAddress(): string | null {
  if (connectedAddress) return connectedAddress;
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;

  const stored = window.localStorage.getItem(CONNECTED_ADDRESS_STORAGE_KEY);
  if (stored) {
    connectedAddress = stored;
  }
  return connectedAddress;
}
export function disconnectWallet(): boolean {
  connectedAddress = null;
  localStorage.removeItem('zkproof_connected_wallet_id');
  localStorage.removeItem(CONNECTED_ADDRESS_STORAGE_KEY);
  return true;
}
