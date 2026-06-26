import { StellarWalletsKit, ensureKit } from "./kit";
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

// The Stellar SDK v12 types are strict (union types for results); to keep
// this module readable, we cast through `any` at the boundary and reason
// about runtime shapes in the function bodies.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function getKit(): typeof StellarWalletsKit {
  ensureKit();
  return StellarWalletsKit;
}

let connectedAddress: string | null = null;

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
  threshold: number | string,
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

  const server: Any = new rpc.Server(RPC_URL);

  // 1. Build the 4 × 32-byte public inputs.
  const thresholdNum = Number(publicInputs[0] ?? threshold);
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
  dv.setBigUint64(24, BigInt(thresholdNum), false);
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
        nativeToScVal(BigInt(thresholdNum), { type: "i128" }),
      ),
    )
    .setTimeout(30)
    .build();

  // 4. Simulate before asking the user to sign.
  let prepared: Any;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (err: Any) {
    console.error("Simulation failed:", err);
    const msg = err?.message ?? String(err);
    throw new Error(
      `On-chain simulation failed: ${msg}. ` +
        `If this says "verification failed", the VK on-chain does not match ` +
        `the circuit — run ./scripts/update-vk.sh.`,
    );
  }

  // 5. Sign via the connected wallet.
  const xdrToSign = prepared.toXDR();
  const signResult: Any = await getKit().signTransaction(xdrToSign, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: connectedAddress,
  });
  if (signResult.error || !signResult.signedTxXdr) {
    throw new Error(
      signResult.error?.message ??
        "Wallet transaction signing failed or was rejected.",
    );
  }

  // 6. Submit + poll.
  const signedTx = TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE,
  );
  const sendResponse = await server.sendTransaction(signedTx);
  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction submission error: ${JSON.stringify(sendResponse.errorResult)}`,
    );
  }
  const final = await server.pollTransaction(sendResponse.hash);
  if (final.status !== "SUCCESS") {
    throw new Error(`Transaction failed on-chain: ${final.status}`);
  }
  return sendResponse.hash;
}

/** Read-only: does the given address have a non-expired attestation of this type? */
export async function checkAttestation(
  address: string,
  attestationType: string,
): Promise<{ valid: boolean; attestation: any | null }> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID is not configured.");

  const server: Any = new rpc.Server(RPC_URL);
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
  if (!simulation.results) {
    return { valid: false, attestation: null };
  }
  const result = simulation.results[0];
  if (!result || !result.xdr) {
    return { valid: false, attestation: null };
  }
  const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
  const valid = scValToNative(scVal);

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

  const server: Any = new rpc.Server(RPC_URL);
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
  if (!simulation.results) return null;
  const result = simulation.results[0];
  if (!result || !result.xdr) return null;

  const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
  const nativeVal = scValToNative(scVal);
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

// The WalletPicker module calls these to keep the address in sync.
export function setConnectedAddress(addr: string | null): void {
  connectedAddress = addr;
}
export function getConnectedAddress(): string | null {
  return connectedAddress;
}
export function disconnectWallet(): boolean {
  connectedAddress = null;
  return true;
}
