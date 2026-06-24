import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StrKey } from '@stellar/stellar-sdk';
import { facilitiesConfig, navigationConfig } from '../config';
import {
  submitAttestation,
  checkAttestation,
  fetchWalletBalances,
  type WalletAssetBalance,
} from '../lib/stellar';
import { computeCommitment, generateProof } from '../lib/prover';
import type { ZkState } from '../App';

interface FacilityDetailProps {
  walletAddress: string;
  connectWallet: () => void;
  zkState: ZkState;
  setZkState: React.Dispatch<React.SetStateAction<ZkState>>;
}

type VerificationResult =
  | {
      valid: true;
      address: string;
      type: string;
      threshold: number;
      issuedAt: string;
      expiresAt: string;
      proofHash: string;
    }
  | {
      valid: false;
      error?: string;
    };

export default function FacilityDetail({
  walletAddress,
  connectWallet: triggerWalletConnect,
  zkState,
  setZkState,
}: FacilityDetailProps) {
  const { slug } = useParams<{ slug: string }>();

  // Form Inputs
  const [formData, setFormData] = useState({
    income: zkState.income,
    balance: zkState.balance,
    creditScore: zkState.creditScore,
    selectedAssetId: zkState.selectedAssetId,
    attestationType: zkState.attestationType,
    threshold: zkState.threshold,
    verifyAddress: walletAddress || '',
    verifyType: zkState.attestationType,
  });

  // UI Actions & Logs State
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAssetBalance[]>([]);
  const [walletAssetError, setWalletAssetError] = useState<string>('');
  const [walletAssetsLoading, setWalletAssetsLoading] = useState(false);
  const commitmentStatusRef = useRef<HTMLDivElement | null>(null);

  const facility = useMemo(
    () => facilitiesConfig.items.find((item) => item.slug === slug) ?? null,
    [slug]
  );

  const selectedWalletAsset = useMemo(
    () =>
      walletAssets.find((asset) => asset.id === formData.selectedAssetId) ??
      walletAssets[0] ??
      null,
    [walletAssets, formData.selectedAssetId]
  );

  // Sync state if wallet connects/disconnects
  useEffect(() => {
    if (walletAddress && !formData.verifyAddress) {
      setFormData(prev => ({ ...prev, verifyAddress: walletAddress }));
    }
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadWalletAssets = async () => {
      if (!walletAddress) {
        setWalletAssets([]);
        setWalletAssetError('');
        return;
      }

      setWalletAssetsLoading(true);
      setWalletAssetError('');

      try {
        const assets = await fetchWalletBalances(walletAddress);
        if (cancelled) return;

        setWalletAssets(assets);

        if (assets.length === 0) {
          setWalletAssetError('No positive wallet balances found on this Stellar account.');
          return;
        }

        const preferredAsset =
          assets.find((asset) => asset.id === zkState.selectedAssetId) ??
          assets.find((asset) => asset.isNative) ??
          assets[0];

        setFormData((prev) => ({
          ...prev,
          selectedAssetId: preferredAsset.id,
          balance:
            prev.attestationType === 'balance' && !prev.balance
              ? preferredAsset.balance
              : prev.balance,
        }));

        setZkState((prev) => ({
          ...prev,
          balance:
            prev.attestationType === 'balance' && !prev.balance
              ? preferredAsset.balance
              : prev.balance,
          selectedAssetId: preferredAsset.id,
          selectedAssetCode: preferredAsset.code,
          selectedAssetIssuer: preferredAsset.issuer ?? '',
        }));
      } catch (err: any) {
        if (cancelled) return;
        setWalletAssets([]);
        setWalletAssetError(err?.message ?? 'Failed to load wallet balances.');
      } finally {
        if (!cancelled) {
          setWalletAssetsLoading(false);
        }
      }
    };

    loadWalletAssets();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, zkState.selectedAssetId, zkState.attestationType]);

  useEffect(() => {
    if (formData.attestationType !== 'balance' || !selectedWalletAsset) return;

    setFormData((prev) => {
      if (prev.selectedAssetId === selectedWalletAsset.id && prev.balance === selectedWalletAsset.balance) {
        return prev;
      }

      return {
        ...prev,
        selectedAssetId: selectedWalletAsset.id,
        balance: selectedWalletAsset.balance,
      };
    });

    setZkState((prev) => ({
      ...prev,
      balance: selectedWalletAsset.balance,
      selectedAssetId: selectedWalletAsset.id,
      selectedAssetCode: selectedWalletAsset.code,
      selectedAssetIssuer: selectedWalletAsset.issuer ?? '',
    }));
  }, [formData.attestationType, selectedWalletAsset, setZkState]);

  useEffect(() => {
    if (slug !== 'enter-data') return;
    if (!loading && logs.length === 0 && !zkState.commitment) return;

    const frame = window.requestAnimationFrame(() => {
      commitmentStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [slug, loading, logs.length, zkState.commitment]);

  if (!facility) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#050a0f',
          color: '#e8ecf1',
          fontFamily: "'IBM Plex Mono', monospace",
          padding: '40px',
        }}
      >
        <p>{facilitiesConfig.detailNotFoundText}</p>
        <Link to="/" style={{ color: '#00d4aa', textDecoration: 'underline' }}>
          {facilitiesConfig.detailReturnText}
        </Link>
      </div>
    );
  }

  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${text}`]);
  };

  // ── Step 1: Generate Poseidon Commitment ──
  // Real Poseidon BN254 hash, computed by executing the circuit and reading
  // the commitment back from the public input.
  const handleGenerateCommitment = async () => {
    if (formData.attestationType === 'balance' && walletAddress && !selectedWalletAsset) {
      addLog('No Stellar wallet asset was detected yet. Wait for wallet balances to load or reconnect your wallet.');
      return;
    }

    const val =
      formData.attestationType === 'income'
        ? formData.income
        : formData.attestationType === 'balance'
          ? formData.balance
          : formData.creditScore;
    if (!val) {
      addLog('Please enter a value first.');
      return;
    }

    setLoading(true);
    setLogs([]);
    setProgress(5);
    addLog('Initializing Noir + bb.js (one-time ~150MB download on first run)...');

    try {
      setProgress(30);
      addLog(`Compiling witness for ${formData.attestationType} = ${val}...`);
      if (formData.attestationType === 'balance' && selectedWalletAsset) {
        addLog(`Using detected wallet asset ${selectedWalletAsset.code} balance ${selectedWalletAsset.balance}.`);
      }

      // The data_source_secret is randomised client-side; the user only
      // enters the *value* (income/balance/credit). The secret ties the
      // commitment to this specific session so it can't be replayed.
      const dataSourceSecret =
        Math.floor(Math.random() * 1e9) + Date.now() % 1e6;

      setProgress(70);
      const commitmentHex = await computeCommitment(
        dataSourceSecret,
        Number(val),
      );
      addLog(`Poseidon BN254 commitment computed in browser.`);

      setProgress(100);
      addLog(`Commitment: ${commitmentHex.slice(0, 24)}…${commitmentHex.slice(-8)}`);

      setZkState((prev) => ({
        ...prev,
        income: formData.income,
        balance: formData.balance,
        creditScore: formData.creditScore,
        selectedAssetId: selectedWalletAsset?.id ?? prev.selectedAssetId,
        selectedAssetCode: selectedWalletAsset?.code ?? prev.selectedAssetCode,
        selectedAssetIssuer: selectedWalletAsset?.issuer ?? prev.selectedAssetIssuer,
        attestationType: formData.attestationType,
        commitment: commitmentHex,
        // Stash the secret in a transient field; we don't persist it
        // but we need it for proof generation.
        publicInputs: [formData.threshold, formData.attestationType, String(Date.now()), commitmentHex, String(dataSourceSecret)],
      }));
    } catch (err: any) {
      console.error(err);
      addLog(`Error: ${err?.message ?? 'Failed to compute commitment'}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Generate ZK Proof ──
  // Real UltraHonk proof via bb.js.
  const handleGenerateProof = async () => {
    if (!zkState.commitment) {
      addLog('Please complete Step 01 (Enter Data) first!');
      return;
    }

    const val =
      formData.attestationType === 'income'
        ? Number(zkState.income)
        : formData.attestationType === 'balance'
          ? Number(zkState.balance)
          : Number(zkState.creditScore);
    const dataSourceSecret = zkState.publicInputs?.[4]
      ? Number(zkState.publicInputs[4])
      : 0;

    setLoading(true);
    setLogs([]);
    setProgress(5);
    addLog('Loading UltraHonk prover (Barretenberg WASM)...');

    try {
      setProgress(30);
      addLog('Executing Noir circuit to produce witness...');

      setProgress(60);
      const result = await generateProof({
        attestationType: zkState.attestationType,
        threshold: Number(formData.threshold),
        privateValue: val,
        dataSourceSecret,
      });

      setProgress(95);
      addLog(
        `Proof generated in ${(result.durationMs / 1000).toFixed(1)}s ` +
          `(${result.proof.length} bytes).`,
      );

      addLog(
        `Public inputs: threshold=${formData.threshold}, type=${zkState.attestationType}, ` +
          `ts=${result.publicInputs
            ? Math.floor(Date.now() / 1000)
            : '?'}, commitment=${result.commitmentHex.slice(0, 18)}…`,
      );
      if (zkState.attestationType === 'balance') {
        addLog(`Balance attestation asset: ${zkState.selectedAssetCode || selectedWalletAsset?.code || 'USD'}.`);
      }

      setProgress(100);
      setZkState((prev) => ({
        ...prev,
        threshold: formData.threshold,
        proof: result.proofHex,
        publicInputs: [
          formData.threshold,
          zkState.attestationType,
          String(Math.floor(Date.now() / 1000)),
          result.commitmentHex,
        ],
      }));
    } catch (err: any) {
      console.error(err);
      addLog(`Error: ${err?.message ?? 'Failed to generate proof'}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: On-Chain Attest (real) ──
  const handleOnChainAttest = async () => {
    if (!zkState.proof) {
      addLog('Please complete Step 02 (Generate Proof) first!');
      return;
    }

    if (!walletAddress) {
      addLog('No wallet connected. Opening wallet picker...');
      triggerWalletConnect();
      return;
    }

    setLoading(true);
    setLogs([]);
    setProgress(5);
    addLog('Connecting to Soroban testnet RPC...');

    try {
      addLog('Fetching your account from the network...');
      setProgress(20);

      // The proof hex is the on-chain form (0x-prefixed). submitAttestation
      // accepts that.
      addLog('Encoding proof + 4 public inputs for the contract call...');
      setProgress(40);

      addLog('Requesting wallet signature for attest() transaction...');
      setProgress(60);

      const txHash = await submitAttestation(
        zkState.proof,
        zkState.publicInputs,
        zkState.attestationType,
        zkState.threshold,
      );

      setProgress(100);
      addLog(`✅ Transaction confirmed on Stellar testnet!`);
      addLog(`Tx hash: ${txHash}`);

      setZkState((prev) => ({ ...prev, txHash }));
    } catch (err: any) {
      console.error(err);
      addLog(`Error: ${err?.message ?? 'On-chain submission failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 4: Verification Check (real) ──
  const handleVerifyCheck = async () => {
    const normalizedVerifyAddress = formData.verifyAddress.trim();

    if (!normalizedVerifyAddress) {
      addLog('Please enter a Stellar address to verify.');
      return;
    }

    if (!StrKey.isValidEd25519PublicKey(normalizedVerifyAddress)) {
      const error =
        'Invalid Stellar public key. Enter a full G... address from the holder wallet.';
      setVerificationResult({ valid: false, error });
      setLogs([]);
      addLog(`Error: ${error}`);
      return;
    }

    setLoading(true);
    setLogs([]);
    setVerificationResult(null);
    setProgress(10);
    addLog(
      `Querying contract check() for ${normalizedVerifyAddress.slice(0, 8)}…` +
        ` (type=${formData.verifyType})...`,
    );

    try {
      setProgress(50);
      const { valid, attestation } = await checkAttestation(
        normalizedVerifyAddress,
        formData.verifyType,
      );

      setProgress(100);
      if (valid && attestation) {
        addLog(`✅ Contract returned: valid attestation found.`);
        setVerificationResult({
          valid: true,
          address: normalizedVerifyAddress,
          type: attestation.attestationType,
          threshold: attestation.threshold,
          issuedAt: new Date(attestation.issuedAt * 1000).toLocaleString(),
          expiresAt: new Date(attestation.expiresAt * 1000).toLocaleString(),
          proofHash: attestation.proofHash,
        });
      } else {
        addLog('Contract returned: no valid attestation found.');
        setVerificationResult({ valid: false });
      }
    } catch (err: any) {
      console.error(err);
      const error =
        err?.message === 'Network Error'
          ? 'Could not reach Soroban testnet RPC. Check your network or the RPC endpoint and try again.'
          : err?.message ?? 'Verification query failed.';
      addLog(`Error: ${error}`);
      setVerificationResult({ valid: false, error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050a0f',
        color: '#e8ecf1',
        fontFamily: "'IBM Plex Mono', monospace",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Navbar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(136, 153, 170, 0.1)',
          background: 'rgba(5, 10, 15, 0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span
          style={{
            fontSize: '18px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#00d4aa',
          }}
        >
          {navigationConfig.brandName}
        </span>
        <Link
          to="/#facilities"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#00d4aa',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(0, 212, 170, 0.25)',
            paddingBottom: '2px',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.borderBottomColor = '#00d4aa';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.borderBottomColor = 'rgba(0, 212, 170, 0.25)';
          }}
        >
          {facilitiesConfig.detailBackText}
        </Link>
      </nav>

      {/* Main split content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {/* Left Side: Article info */}
        <div
          style={{
            width: '42%',
            minWidth: '400px',
            padding: '60px 48px',
            borderRight: '1px solid rgba(136, 153, 170, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              color: '#00d4aa',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              marginBottom: '16px',
            }}
          >
            {facility.code}
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 400,
              lineHeight: '34px',
              textTransform: 'uppercase',
              margin: '0 0 32px 0',
              color: '#e8ecf1',
            }}
          >
            {facility.article.title}
          </h1>
          <div style={{ maxWidth: '440px' }}>
            {facility.article.paragraphs.map((paragraph, index) => (
              <p
                key={`${facility.slug}-${index}`}
                style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  lineHeight: '1.85',
                  margin: '0 0 20px 0',
                  color: '#8899aa',
                }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Right Side: Interactive ZK Form panels */}
        <div
          style={{
            flex: 1,
            background: '#0a1118',
            padding: '60px 48px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto' }}>
            
            {/* Step 1 Form: Enter Data */}
            {slug === 'enter-data' && (
              <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(136,153,170,0.1)' }}>
                <h3 style={{ textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.05em', marginBottom: '24px', color: '#00d4aa' }}>
                  Generate Private Data Commitment
                </h3>

                {/* Tab selector for attestation type */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  {(['income', 'balance', 'credit'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormData(prev => ({ ...prev, attestationType: type }))}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: formData.attestationType === type ? 'rgba(0, 212, 170, 0.15)' : 'transparent',
                        color: formData.attestationType === type ? '#00d4aa' : '#8899aa',
                        border: '1px solid ' + (formData.attestationType === type ? '#00d4aa' : 'rgba(136,153,170,0.15)'),
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Input fields based on selection */}
                {formData.attestationType === 'income' && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Monthly Income (USD)
                    </label>
                    <input
                      type="number"
                      id="income-input"
                      placeholder="e.g. 5000"
                      value={formData.income}
                      onChange={(e) => setFormData(prev => ({ ...prev, income: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#050a0f',
                        border: '1px solid rgba(136,153,170,0.15)',
                        color: '#e8ecf1',
                        fontFamily: "'IBM Plex Mono', monospace",
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {formData.attestationType === 'balance' && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Wallet Asset Source
                    </label>

                    {walletAddress ? (
                      <>
                        <select
                          value={formData.selectedAssetId}
                          onChange={(e) => {
                            const nextAsset = walletAssets.find((asset) => asset.id === e.target.value);
                            setFormData(prev => ({
                              ...prev,
                              selectedAssetId: e.target.value,
                              balance: nextAsset?.balance ?? prev.balance,
                            }));
                            if (nextAsset) {
                              setZkState(prev => ({
                                ...prev,
                                balance: nextAsset.balance,
                                selectedAssetId: nextAsset.id,
                                selectedAssetCode: nextAsset.code,
                                selectedAssetIssuer: nextAsset.issuer ?? '',
                              }));
                            }
                          }}
                          disabled={walletAssetsLoading || walletAssets.length === 0}
                          style={{
                            width: '100%',
                            padding: '12px',
                            marginBottom: '12px',
                            background: '#050a0f',
                            border: '1px solid rgba(136,153,170,0.15)',
                            color: '#e8ecf1',
                            fontFamily: "'IBM Plex Mono', monospace",
                            boxSizing: 'border-box',
                          }}
                        >
                          {walletAssets.length === 0 ? (
                            <option value="">
                              {walletAssetsLoading ? 'Loading wallet assets...' : 'No wallet assets detected'}
                            </option>
                          ) : (
                            walletAssets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.label} — {asset.balance}
                              </option>
                            ))
                          )}
                        </select>

                        <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(0, 212, 170, 0.05)', border: '1px solid rgba(0, 212, 170, 0.15)' }}>
                          <div style={{ fontSize: '10px', color: '#00d4aa', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Detected Wallet Balance
                          </div>
                          <div style={{ fontSize: '12px', color: '#e8ecf1' }}>
                            {selectedWalletAsset
                              ? `${selectedWalletAsset.balance} ${selectedWalletAsset.code}`
                              : walletAssetsLoading
                                ? 'Loading balances from Horizon…'
                                : 'No positive Stellar asset balance found.'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255, 68, 102, 0.05)', border: '1px solid rgba(255, 68, 102, 0.15)', color: '#ff8a99', fontSize: '11px', lineHeight: 1.6 }}>
                        Connect your wallet first so zkProof can read your live Stellar asset balances instead of assuming USD.
                      </div>
                    )}

                    {walletAssetError && (
                      <div style={{ marginBottom: '12px', color: '#ff8a99', fontSize: '11px', lineHeight: 1.6 }}>
                        {walletAssetError}
                      </div>
                    )}

                    <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Account Balance ({selectedWalletAsset?.code || zkState.selectedAssetCode || 'USD'})
                    </label>
                    <input
                      type="number"
                      placeholder={selectedWalletAsset ? `e.g. ${selectedWalletAsset.balance}` : 'e.g. 25000'}
                      value={formData.balance}
                      onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#050a0f',
                        border: '1px solid rgba(136,153,170,0.15)',
                        color: '#e8ecf1',
                        fontFamily: "'IBM Plex Mono', monospace",
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {formData.attestationType === 'credit' && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Credit Score (300 - 850)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 750"
                      value={formData.creditScore}
                      onChange={(e) => setFormData(prev => ({ ...prev, creditScore: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#050a0f',
                        border: '1px solid rgba(136,153,170,0.15)',
                        color: '#e8ecf1',
                        fontFamily: "'IBM Plex Mono', monospace",
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={handleGenerateCommitment}
                  disabled={loading}
                  className="btn-zk btn-zk-primary"
                  style={{ width: '100%', padding: '14px 0' }}
                >
                  {loading ? 'COMPUTING...' : 'GENERATE COMMITMENT'}
                </button>

                {(loading || logs.length > 0 || zkState.commitment) && (
                  <div
                    ref={commitmentStatusRef}
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: 'rgba(0, 212, 170, 0.05)',
                      border: '1px solid rgba(0, 212, 170, 0.18)',
                      borderRadius: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '10px',
                      }}
                    >
                      <span style={{ fontSize: '10px', color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Commitment status
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          color: loading ? '#00d4aa' : logs.some((log) => log.includes('Error')) ? '#ff8a99' : '#e8ecf1',
                          textTransform: 'uppercase',
                        }}
                      >
                        {loading ? `Computing... ${progress}%` : logs.some((log) => log.includes('Error')) ? 'Error' : zkState.commitment ? 'Commitment ready' : 'Waiting'}
                      </span>
                    </div>

                    {loading && (
                      <div style={{ width: '100%', height: '2px', background: 'rgba(0, 212, 170, 0.1)', marginBottom: '12px' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#00d4aa', transition: 'width 0.2s' }} />
                      </div>
                    )}

                    {logs.length > 0 && (
                      <div style={{ fontSize: '11px', color: logs[logs.length - 1]?.includes('Error') ? '#ff8a99' : '#8899aa', lineHeight: 1.5, marginBottom: zkState.commitment ? '12px' : 0 }}>
                        {logs[logs.length - 1]}
                      </div>
                    )}

                    {zkState.commitment && !loading && (
                      <div style={{ paddingTop: '12px', borderTop: '1px dashed rgba(0, 212, 170, 0.2)' }}>
                        <div style={{ fontSize: '10px', color: '#00d4aa', textTransform: 'uppercase', marginBottom: '4px' }}>Active Commitment</div>
                        <div style={{ fontSize: '11px', wordBreak: 'break-all', color: '#e8ecf1' }}>{zkState.commitment}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2 Form: Generate ZK Proof */}
            {slug === 'generate-proof' && (
              <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(136,153,170,0.1)' }}>
                <h3 style={{ textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.05em', marginBottom: '24px', color: '#00d4aa' }}>
                  ZK Proof Engine
                </h3>

                <div style={{ marginBottom: '20px', padding: '12px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.1)' }}>
                  <span style={{ fontSize: '10px', color: '#8899aa', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Active commitment (from Step 01)
                  </span>
                  <span style={{ fontSize: '11px', color: zkState.commitment ? '#e8ecf1' : '#ff4466', wordBreak: 'break-all' }}>
                    {zkState.commitment || 'No commitment found. Please complete Step 01.'}
                  </span>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Proven Threshold Value{formData.attestationType === 'balance' ? ` (${selectedWalletAsset?.code || zkState.selectedAssetCode || 'USD'})` : ''}
                  </label>
                  <input
                    type="number"
                    id="threshold-input"
                    value={formData.threshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, threshold: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#050a0f',
                      border: '1px solid rgba(136,153,170,0.15)',
                      color: '#e8ecf1',
                      fontFamily: "'IBM Plex Mono', monospace",
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#556677', marginTop: '6px', display: 'block' }}>
                    This is the public value you prove your private data exceeds{formData.attestationType === 'balance' ? ` in ${selectedWalletAsset?.code || zkState.selectedAssetCode || 'the selected asset'}` : ''}.
                  </span>
                </div>

                <button
                  onClick={handleGenerateProof}
                  disabled={loading || !zkState.commitment}
                  id="generate-proof-btn"
                  className="btn-zk btn-zk-primary"
                  style={{ width: '100%', padding: '14px 0' }}
                >
                  {loading ? 'COMPILING WITNESS...' : 'GENERATE ZK PROOF'}
                </button>

                {zkState.proof && !loading && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0, 212, 170, 0.05)', border: '1px dashed #00d4aa' }}>
                    <div style={{ fontSize: '10px', color: '#00d4aa', textTransform: 'uppercase', marginBottom: '4px' }}>Active ZK Proof</div>
                    <div style={{ fontSize: '11px', wordBreak: 'break-all', color: '#e8ecf1' }}>{zkState.proof.slice(0, 64)}...</div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3 Form: On-chain attestation */}
            {slug === 'on-chain-attestation' && (
              <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(136,153,170,0.1)' }}>
                <h3 style={{ textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.05em', marginBottom: '24px', color: '#00d4aa' }}>
                  Soroban Contract Attestation
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ padding: '12px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.1)' }}>
                    <span style={{ fontSize: '10px', color: '#8899aa', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                      ZK Proof (from Step 02)
                    </span>
                    <span style={{ fontSize: '11px', color: zkState.proof ? '#e8ecf1' : '#ff4466', wordBreak: 'break-all' }}>
                      {zkState.proof ? `${zkState.proof.slice(0, 48)}...` : 'No ZK proof found. Please complete Step 02.'}
                    </span>
                  </div>

                  <div style={{ padding: '12px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.1)' }}>
                    <span style={{ fontSize: '10px', color: '#8899aa', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Execution
                    </span>
                    <span style={{ fontSize: '11px', color: '#00d4aa', fontWeight: 600 }}>
                      ON-CHAIN — Soroban contract via Stellar Wallet
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleOnChainAttest}
                  disabled={loading || !zkState.proof}
                  className="btn-zk btn-zk-primary"
                  style={{ width: '100%', padding: '14px 0' }}
                >
                  {loading ? 'SUBMITTING TO LEDGER...' : 'SUBMIT ON-CHAIN ATTESTATION'}
                </button>

                {zkState.txHash && !loading && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0, 212, 170, 0.05)', border: '1px solid #00d4aa' }}>
                    <div style={{ fontSize: '10px', color: '#00d4aa', textTransform: 'uppercase', marginBottom: '4px' }}>Attestation Confirmed</div>
                    <div style={{ fontSize: '11px', wordBreak: 'break-all', color: '#e8ecf1', marginBottom: '8px' }}>
                      Tx Hash: {zkState.txHash}
                    </div>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${zkState.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '10px', color: '#00d4aa', textDecoration: 'underline' }}
                    >
                      View on StellarExpert
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Step 4 Form: Verify Attestation */}
            {slug === 'verify' && (
              <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(136,153,170,0.1)' }}>
                <h3 style={{ textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.05em', marginBottom: '24px', color: '#00d4aa' }}>
                  Verify Attestation Credentials
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Holder Stellar Wallet Address
                  </label>
                  <input
                    type="text"
                    id="verify-address-input"
                    placeholder="e.g. GB2A... or GDEMO..."
                    value={formData.verifyAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, verifyAddress: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#050a0f',
                      border: '1px solid rgba(136,153,170,0.15)',
                      color: '#e8ecf1',
                      fontFamily: "'IBM Plex Mono', monospace",
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Attestation Type
                  </label>
                  <select
                    value={formData.verifyType}
                    onChange={(e) => setFormData(prev => ({ ...prev, verifyType: e.target.value as any }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#050a0f',
                      border: '1px solid rgba(136,153,170,0.15)',
                      color: '#e8ecf1',
                      fontFamily: "'IBM Plex Mono', monospace",
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="income">Income Threshold</option>
                    <option value="balance">Balance Threshold</option>
                    <option value="credit">Credit Score Threshold</option>
                  </select>
                </div>

                <button
                  onClick={handleVerifyCheck}
                  disabled={loading}
                  id="check-attestation-btn"
                  className="btn-zk btn-zk-primary"
                  style={{ width: '100%', padding: '14px 0' }}
                >
                  {loading ? 'QUERYING SOROBAN...' : 'RUN VERIFICATION'}
                </button>

                {/* Verification results display */}
                {verificationResult && (
                  <div style={{ marginTop: '24px' }}>
                    {verificationResult.valid ? (
                      <div style={{ padding: '18px', background: 'rgba(0, 212, 170, 0.08)', border: '1px solid #00d4aa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d4aa' }} />
                          <span style={{ fontSize: '11px', color: '#00d4aa', fontWeight: 600, textTransform: 'uppercase' }}>
                            VERIFICATION SUCCESSFUL: HOLDER ELIGIBLE
                          </span>
                        </div>
                        <table style={{ width: '100%', fontSize: '11px', color: '#8899aa', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid rgba(136,153,170,0.1)' }}>
                              <td style={{ padding: '6px 0', textTransform: 'uppercase' }}>Type:</td>
                              <td style={{ padding: '6px 0', color: '#e8ecf1', textAlign: 'right', fontWeight: 600 }}>{verificationResult.type}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(136,153,170,0.1)' }}>
                              <td style={{ padding: '6px 0', textTransform: 'uppercase' }}>Proven Min:</td>
                              <td style={{ padding: '6px 0', color: '#e8ecf1', textAlign: 'right', fontWeight: 600 }}>${verificationResult.threshold}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(136,153,170,0.1)' }}>
                              <td style={{ padding: '6px 0', textTransform: 'uppercase' }}>Issued At:</td>
                              <td style={{ padding: '6px 0', color: '#e8ecf1', textAlign: 'right' }}>{verificationResult.issuedAt}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(136,153,170,0.1)' }}>
                              <td style={{ padding: '6px 0', textTransform: 'uppercase' }}>Expires At:</td>
                              <td style={{ padding: '6px 0', color: '#e8ecf1', textAlign: 'right' }}>{verificationResult.expiresAt}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '6px 0', textTransform: 'uppercase' }}>Proof Hash:</td>
                              <td style={{ padding: '6px 0', color: '#e8ecf1', textAlign: 'right', wordBreak: 'break-all' }}>{verificationResult.proofHash}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '18px', background: 'rgba(255, 68, 102, 0.08)', border: '1px solid #ff4466' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4466' }} />
                          <span style={{ fontSize: '11px', color: '#ff4466', fontWeight: 600, textTransform: 'uppercase' }}>
                            {verificationResult.error
                              ? 'VERIFICATION FAILED'
                              : 'VERIFICATION FAILED: NO VALID RECORD FOUND'}
                          </span>
                        </div>
                        {verificationResult.error && (
                          <div style={{ marginTop: '10px', fontSize: '11px', color: '#ff9fb1', lineHeight: 1.5 }}>
                            {verificationResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Logs console */}
            {(logs.length > 0 || loading) && (
              <div
                style={{
                  marginTop: '32px',
                  background: '#050a0f',
                  border: '1px solid rgba(136, 153, 170, 0.12)',
                  padding: '16px',
                  borderRadius: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#00d4aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Circuit Execution Terminal
                  </span>
                  {loading && <span className="spinner" style={{ color: '#00d4aa' }} />}
                </div>

                {loading && (
                  <div style={{ width: '100%', height: '2px', background: 'rgba(0, 212, 170, 0.1)', marginBottom: '12px' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: '#00d4aa', transition: 'width 0.2s' }} />
                  </div>
                )}

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {logs.map((log, index) => (
                    <div key={index} style={{ fontSize: '11px', color: log.includes('Success!') ? '#00d4aa' : log.includes('Error') ? '#ff4466' : '#8899aa', lineHeight: 1.4 }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
