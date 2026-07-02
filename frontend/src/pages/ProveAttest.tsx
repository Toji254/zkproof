import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navigationConfig } from '../config';
import { computeCommitment, generateProof } from '../lib/prover';
import { fetchWalletBalances, submitAttestation } from "../lib/stellar";
import { getQaConfig } from "../lib/qa";
import { normalizeAttestationInput } from '../lib/attestationMath';
import { CONTRACT_ID, NETWORK } from '../lib/config';
import { getStellarExpertAccountUrl, getStellarExpertContractUrl, getStellarExpertTxUrl } from '../lib/explorer';
import { ensureProfile, updateProfile } from '../lib/profile';
import type { ZkState } from '../App';

interface ProveAttestProps {
  walletAddress: string;
  connectWallet: () => void;
  zkState: ZkState;
  setZkState: React.Dispatch<React.SetStateAction<ZkState>>;
}

type Stage = 'idle' | 'commitment' | 'proof' | 'attest' | 'done' | 'error';

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  commitment: 'Sealing your private data...',
  proof: 'Generating zero-knowledge proof (this takes ~30s)...',
  attest: 'Recording qualification on Stellar...',
  done: 'Qualification recorded!',
  error: 'Something went wrong.',
};

const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0,
  commitment: 20,
  proof: 65,
  attest: 90,
  done: 100,
  error: 0,
};

const INCOME_THRESHOLDS = [
  { label: '2,000 / mo', value: '2000' },
  { label: '3,000 / mo', value: '3000' },
  { label: '5,000 / mo', value: '5000' },
  { label: '8,000 / mo', value: '8000' },
];

const CREDIT_THRESHOLDS = [
  { label: '620', value: '620' },
  { label: '680', value: '680' },
  { label: '720', value: '720' },
  { label: '750', value: '750' },
];

function buildBalanceThresholds(balance: number, code: string) {
  const base = balance > 0 ? balance : 10000;
  const steps = [0.25, 0.5, 0.75, 1.0].map((f) => Math.round(base * f));
  return steps.map((v) => ({ label: `${v.toLocaleString()} ${code}`, value: String(v) }));
}

interface WalletAsset { code: string; balance: string; numericBalance: number; isNative: boolean; }

export default function ProveAttest({
  walletAddress,
  connectWallet,
  zkState: _zkState,
  setZkState,
}: ProveAttestProps) {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qa = getQaConfig();
  const proveQa = qa?.prove;
  const suppressNetwork = qa?.suppressNetwork ?? false;
  const renterProfile = useMemo(() => ensureProfile('renter'), []);
  const sharedLandlordPublicId = query.get('landlordId') ?? '';
  const requestedAttestationType = query.get('type') as 'income' | 'balance' | 'credit' | null;
  const [shareCopied, setShareCopied] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const [verifyLinkCopied, setVerifyLinkCopied] = useState(false);

  const [attType, setAttType] = useState<'income' | 'balance' | 'credit'>(proveQa?.attType ?? requestedAttestationType ?? 'income');
  const [privateValue, setPrivateValue] = useState(proveQa?.privateValue ?? '');
  const [threshold, setThreshold] = useState(proveQa?.threshold ?? INCOME_THRESHOLDS[1].value);
  const [stage, setStage] = useState<Stage>(proveQa?.stage ?? 'idle');
  const [errorMsg, setErrorMsg] = useState(proveQa?.errorMsg ?? '');
  const [txHash, setTxHash] = useState(proveQa?.txHash ?? '');
  const [log, setLog] = useState(proveQa?.log ?? '');

  // Wallet asset state
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string>(proveQa?.selectedAssetCode ?? 'XLM');

  // Auto-load wallet assets whenever address changes
  useEffect(() => {
    if (suppressNetwork) return;
    if (!walletAddress) { setWalletAssets([]); return; }
    fetchWalletBalances(walletAddress)
      .then((assets) => {
        const mapped: WalletAsset[] = assets.map((a) => ({
          code: a.code,
          balance: a.balance,
          numericBalance: a.numericBalance,
          isNative: a.isNative,
        }));
        setWalletAssets(mapped);
        // Auto-select the primary asset and fill balance
        const primary = mapped[0];
        if (primary) {
          setSelectedAssetCode(primary.code);
          if (attType === 'balance') setPrivateValue(primary.balance);
        }
      })
      .catch(() => {});
  }, [walletAddress, suppressNetwork]);

  // When switching to balance type, fill with selected asset balance
  useEffect(() => {
    if (attType === 'balance' && walletAssets.length > 0) {
      const asset = walletAssets.find((a) => a.code === selectedAssetCode) ?? walletAssets[0];
      if (asset) {
        setPrivateValue(asset.balance);
        setThreshold(buildBalanceThresholds(asset.numericBalance, asset.code)[1].value);
      }
    } else if (attType === 'income') {
      setThreshold(INCOME_THRESHOLDS[1].value);
      setPrivateValue('');
    } else if (attType === 'credit') {
      setThreshold(CREDIT_THRESHOLDS[1].value);
      setPrivateValue('');
    }
  }, [attType, selectedAssetCode, walletAssets]);

  // Derive current threshold presets and labels from asset
  const currentAsset = walletAssets.find((a) => a.code === selectedAssetCode) ?? walletAssets[0];
  const balanceThresholds = currentAsset
    ? buildBalanceThresholds(currentAsset.numericBalance, currentAsset.code)
    : buildBalanceThresholds(10000, selectedAssetCode);
  const thresholdPresets = attType === 'income' ? INCOME_THRESHOLDS
    : attType === 'balance' ? balanceThresholds
    : CREDIT_THRESHOLDS;
  const assetUnit = attType === 'income' ? '/ mo'
    : attType === 'balance' ? selectedAssetCode
    : 'pts';
  const networkSlug = NETWORK === 'PUBLIC' ? 'public' : 'testnet';
  const explorerTxUrl = txHash ? getStellarExpertTxUrl(txHash) : '';
  const explorerAccountUrl = walletAddress ? getStellarExpertAccountUrl(walletAddress) : '';
  const explorerContractUrl = CONTRACT_ID ? getStellarExpertContractUrl(CONTRACT_ID) : '';
  const shareVerifyParams = new URLSearchParams();
  shareVerifyParams.set('type', attType);
  if (txHash) {
    shareVerifyParams.set('tx', txHash);
  }
  if (sharedLandlordPublicId) {
    shareVerifyParams.set('landlordId', sharedLandlordPublicId);
  }
  const shareVerifyQuery = shareVerifyParams.toString();
  const shareVerifyUrl = shareVerifyQuery ? `/facility/verify?${shareVerifyQuery}` : '/facility/verify';
  const shareVerifyAbsoluteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${shareVerifyUrl}`
    : shareVerifyUrl;
  const shareMessage = [
    `ProofPass renter ID: ${renterProfile.publicId}`,
    sharedLandlordPublicId ? `For landlord ID: ${sharedLandlordPublicId}` : null,
    walletAddress ? `Wallet: ${walletAddress}` : null,
    `Attestation type: ${attType}`,
    txHash ? `Stellar tx: ${txHash}` : null,
    `Landlord verify: ${shareVerifyAbsoluteUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const valueLabel = attType === 'income' ? `Monthly Income  [${selectedAssetCode !== 'XLM' ? selectedAssetCode : 'USD'}]`
    : attType === 'balance' ? `Account Balance  [${selectedAssetCode}]`
    : 'Credit Score  [FICO]';
  const valueHint = attType === 'income' ? `Your gross monthly income — stays in your browser only`
    : attType === 'balance' ? `Your total ${selectedAssetCode} balance — stays in your browser only`
    : 'Your FICO or equivalent credit score (300–850) — stays in your browser only';

  useEffect(() => {
    if (!walletAddress) return;
    updateProfile('renter', { walletAddress });
  }, [walletAddress]);

  const addLog = (msg: string) => setLog(msg);

  const handleCopyShareMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareCopied(false);
    }
  };

  const handleCopyWalletAddress = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setWalletCopied(true);
      window.setTimeout(() => setWalletCopied(false), 2000);
    } catch {
      setWalletCopied(false);
    }
  };

  const handleCopyVerifyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareVerifyAbsoluteUrl);
      setVerifyLinkCopied(true);
      window.setTimeout(() => setVerifyLinkCopied(false), 2000);
    } catch {
      setVerifyLinkCopied(false);
    }
  };

  const handleProveAndAttest = async () => {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    if (!privateValue || Number(privateValue) <= 0) {
      setErrorMsg('Please enter your value first.');
      return;
    }

    setErrorMsg('');
    setTxHash('');

    try {
      const normalizedPrivateValue = normalizeAttestationInput(attType, privateValue, 'your private value');
      const normalizedThreshold = normalizeAttestationInput(attType, threshold, 'the landlord threshold');

      // ── Stage 1: Commitment ──────────────────────────────────────
      setStage('commitment');
      addLog('Sealing your private data with a cryptographic commitment…');
      const dataSourceSecret = Math.floor(Math.random() * 1e9) + (Date.now() % 1e6);
      const commitmentHex = await computeCommitment(dataSourceSecret, normalizedPrivateValue);
      addLog('Private commitment sealed. Your data never leaves your browser.');

      // ── Stage 2: ZK Proof ────────────────────────────────────────
      setStage('proof');
      addLog('Generating zero-knowledge proof. This proves you meet the threshold without revealing your actual value…');
      const result = await generateProof({
        attestationType: attType,
        threshold: normalizedThreshold,
        privateValue: normalizedPrivateValue,
        dataSourceSecret,
      });
      addLog(`Proof ready in ${(result.durationMs / 1000).toFixed(1)}s — ${result.proof.length} bytes.`);

      // Stash in global ZK state
      setZkState((prev) => ({
        ...prev,
        attestationType: attType,
        threshold,
        income: attType === 'income' ? privateValue : prev.income,
        balance: attType === 'balance' ? privateValue : prev.balance,
        creditScore: attType === 'credit' ? privateValue : prev.creditScore,
        commitment: commitmentHex,
        proof: result.proofHex,
        publicInputs: [normalizedThreshold.toString(), attType, String(result.timestamp), result.commitmentHex],
      }));

      // ── Stage 3: On-chain Attestation ────────────────────────────
      setStage('attest');
      addLog('Submitting attestation to Stellar testnet. Check your wallet to approve…');
      const hash = await submitAttestation(
        result.proofHex,
        [normalizedThreshold.toString(), attType, String(result.timestamp), result.commitmentHex],
        attType,
        threshold,        // raw human-readable threshold (e.g. "5000"), NOT the scaled circuit value
        (submittedHash: string) => {
          setTxHash(submittedHash);
          addLog(`Transaction submitted to Stellar ${networkSlug}. Waiting for final confirmation…`);
        },
      );

      setTxHash(hash);
      setZkState((prev) => ({ ...prev, txHash: hash }));
      updateProfile('renter', {
        walletAddress,
        lastTxHash: hash,
        lastAttestationType: attType,
      });
      addLog(`✅ Attestation confirmed on Stellar! Tx: ${hash.slice(0, 16)}…`);

      setStage('done');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? 'An error occurred. Please try again.');
      setStage('error');
      addLog(`Error: ${err?.message ?? 'Unknown error'}`);
    }
  };

  const busy = stage !== 'idle' && stage !== 'done' && stage !== 'error';
  const progress = STAGE_PROGRESS[stage];

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
          background: 'rgba(5, 10, 15, 0.9)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00d4aa' }}>
          {navigationConfig.brandName}
        </span>
        <Link
          to="/#facilities"
          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#00d4aa', textDecoration: 'none', borderBottom: '1px solid rgba(0,212,170,0.25)', paddingBottom: '2px' }}
        >
          BACK TO FLOW
        </Link>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          {/* Header */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '11px', color: '#00d4aa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Renter Qualification
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 400, textTransform: 'uppercase', margin: '0 0 16px', lineHeight: 1.2 }}>
              PROVE YOU QUALIFY.<br />REVEAL NOTHING.
            </h1>
            <p style={{ fontSize: '12px', color: '#8899aa', lineHeight: 1.8, margin: 0 }}>
              Enter your private financial value. The app seals it locally, generates a cryptographic proof, and records your qualification on Stellar — your actual number never leaves your browser.
            </p>
          </div>

          {/* Step 1 of 1 form */}
          {stage === 'idle' || stage === 'error' ? (
            <div style={{ background: '#0a1118', border: '1px solid rgba(136,153,170,0.12)', padding: '32px' }}>

              {/* Wallet gate */}
              {!walletAddress && (
                <div
                  style={{
                    marginBottom: '28px',
                    padding: '16px',
                    background: 'rgba(0, 212, 170, 0.06)',
                    border: '1px solid rgba(0,212,170,0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#8899aa', lineHeight: 1.6 }}>
                    Connect your Stellar wallet to sign the on-chain attestation.
                  </span>
                  <button
                    onClick={connectWallet}
                    style={{
                      flexShrink: 0,
                      background: '#00d4aa',
                      color: '#050a0f',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CONNECT
                  </button>
                </div>
              )}

              {walletAddress && (
                <div style={{ marginBottom: '28px', padding: '10px 14px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00d4aa', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#00d4aa' }}>
                    {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#556677', marginLeft: 'auto' }}>wallet connected</span>
                </div>
              )}

              {sharedLandlordPublicId && (
                <div style={{ marginBottom: '28px', padding: '14px', background: 'rgba(136,153,170,0.06)', border: '1px solid rgba(136,153,170,0.16)' }}>
                  <div style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.06em' }}>
                    Landlord request received
                  </div>
                  <div style={{ fontSize: '12px', color: '#ffffff', marginBottom: '8px', lineHeight: 1.6 }}>
                    You are proving for landlord ID <span style={{ color: '#00d4aa', fontWeight: 700 }}>{sharedLandlordPublicId}</span>.
                  </div>
                  <div style={{ fontSize: '10px', color: '#556677', lineHeight: 1.6 }}>
                    This ID is a human-readable handoff reference. It helps both sides match the proof to the intended landlord without turning ProofPass into a messaging app.
                  </div>
                </div>
              )}

              {/* Attestation type tabs */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.06em' }}>
                  What are you proving?
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['income', 'balance', 'credit'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAttType(t)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: attType === t ? 'rgba(0,212,170,0.15)' : 'transparent',
                        color: attType === t ? '#00d4aa' : '#556677',
                        border: '1px solid ' + (attType === t ? '#00d4aa' : 'rgba(136,153,170,0.12)'),
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace",
                        transition: 'all 0.15s',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Private value input + asset selector for balance */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  {valueLabel}
                </label>
                {attType === 'balance' && walletAssets.length > 1 && (
                  <select
                    value={selectedAssetCode}
                    onChange={(e) => setSelectedAssetCode(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', marginBottom: '8px',
                      background: '#050a0f', border: '1px solid rgba(0,212,170,0.2)',
                      color: '#00d4aa', fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '12px', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {walletAssets.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {Number(a.balance).toFixed(4)} (balance)
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id="income-input"
                  type="number"
                  placeholder={attType === 'credit' ? 'e.g. 720' : 'e.g. 5000'}
                  value={privateValue}
                  onChange={(e) => setPrivateValue(e.target.value)}
                  style={{
                    width: '100%', padding: '14px',
                    background: '#050a0f', border: '1px solid rgba(136,153,170,0.15)',
                    color: '#e8ecf1', fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '16px', boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#445566', marginTop: '6px' }}>
                  🔒 {valueHint}
                </div>
              </div>

              {/* Threshold picker */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.06em' }}>
                  Landlord's requirement — prove you meet at least:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {thresholdPresets.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setThreshold(t.value)}
                      style={{
                        padding: '12px',
                        fontSize: '12px',
                        fontWeight: threshold === t.value ? 700 : 400,
                        background: threshold === t.value ? 'rgba(0,212,170,0.12)' : '#050a0f',
                        color: threshold === t.value ? '#00d4aa' : '#8899aa',
                        border: '1px solid ' + (threshold === t.value ? '#00d4aa' : 'rgba(136,153,170,0.1)'),
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace",
                        transition: 'all 0.15s',
                        textAlign: 'center',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#556677' }}>Custom:</span>
                  <input
                    id="threshold-input"
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: '#050a0f',
                      border: '1px solid rgba(136,153,170,0.12)',
                      color: '#e8ecf1',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              {(errorMsg || stage === 'error') && (
                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.3)', fontSize: '11px', color: '#ff9fb1', lineHeight: 1.6 }}>
                  {errorMsg || 'An error occurred. Please try again.'}
                </div>
              )}

              {/* CTA */}
              <button
                id="prove-record-btn"
                onClick={handleProveAndAttest}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '16px 0',
                  background: '#00d4aa',
                  color: '#050a0f',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace",
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,170,0.35)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                {!walletAddress ? '🔗 CONNECT WALLET TO CONTINUE' : 'PROVE & RECORD QUALIFICATION'}
              </button>

              <div style={{ marginTop: '12px', fontSize: '10px', color: '#334455', textAlign: 'center', lineHeight: 1.6 }}>
                Commitment → ZK Proof → Stellar Attestation, all in one click.<br />
                No server sees your data. Proof stays in your browser.
              </div>
            </div>
          ) : (
            /* ── Progress view ── */
            <div style={{ background: '#0a1118', border: '1px solid rgba(136,153,170,0.12)', padding: '40px 32px' }}>

              {stage === 'done' ? (
                <>
                  {/* Success */}
                  <div id="attestation-success-card" style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                    <div style={{ fontSize: '20px', fontWeight: 400, textTransform: 'uppercase', color: '#00d4aa', marginBottom: '8px' }}>
                      Qualification Recorded
                    </div>
                    <div style={{ fontSize: '12px', color: '#8899aa', lineHeight: 1.7 }}>
                      Your attestation is live on Stellar testnet.<br />
                      Share your wallet address with landlords to verify.
                    </div>
                  </div>

                  {/* Proof summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                      <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Renter ID</span>
                      <span style={{ fontSize: '11px', color: '#00d4aa', fontWeight: 700 }}>{renterProfile.publicId}</span>
                    </div>
                    {sharedLandlordPublicId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                        <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Landlord ID</span>
                        <span style={{ fontSize: '11px', color: '#e8ecf1', fontWeight: 700 }}>{sharedLandlordPublicId}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                      <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Type</span>
                      <span style={{ fontSize: '11px', color: '#e8ecf1' }}>{attType.charAt(0).toUpperCase() + attType.slice(1) + ' Threshold'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                      <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Threshold</span>
                      <span style={{ fontSize: '11px', color: '#e8ecf1' }}>{Number(threshold).toLocaleString()} {assetUnit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                      <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Wallet</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <a href={explorerAccountUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#00d4aa', textDecoration: 'underline', fontWeight: 600 }}>
                          {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)} ↗
                        </a>
                        <button
                          onClick={handleCopyWalletAddress}
                          style={{
                            border: '1px solid rgba(0,212,170,0.24)',
                            background: 'transparent',
                            color: walletCopied ? '#00d4aa' : '#8899aa',
                            fontSize: '10px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {walletCopied ? 'copied' : 'copy'}
                        </button>
                      </div>
                    </div>
                    {txHash && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                        <span style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase' }}>Tx Hash</span>
                        <a href={explorerTxUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#00d4aa', textDecoration: 'underline', fontWeight: 600 }}>
                          {txHash.slice(0, 18)}… ↗
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0, 212, 170, 0.05)', border: '1px solid rgba(0, 212, 170, 0.18)' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8899aa', marginBottom: '10px', letterSpacing: '0.06em' }}>
                      Share with landlord
                    </div>
                    <div style={{ fontSize: '11px', color: '#8899aa', lineHeight: 1.7, marginBottom: '12px' }}>
                      Send your wallet address and verification link together. The landlord gets your public renter ID, the correct requirement type, and the clickable on-chain proof trail already prefilled.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      <button
                        onClick={handleCopyWalletAddress}
                        style={{
                          padding: '12px 0',
                          background: 'transparent',
                          border: '1px solid rgba(0,212,170,0.28)',
                          color: walletCopied ? '#00d4aa' : '#e8ecf1',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {walletCopied ? 'Copied wallet' : 'Copy wallet'}
                      </button>
                      <button
                        onClick={handleCopyVerifyLink}
                        style={{
                          padding: '12px 0',
                          background: 'transparent',
                          border: '1px solid rgba(0,212,170,0.28)',
                          color: verifyLinkCopied ? '#00d4aa' : '#e8ecf1',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {verifyLinkCopied ? 'Copied verify link' : 'Copy verify link'}
                      </button>
                      <button
                        onClick={handleCopyShareMessage}
                        style={{
                          padding: '12px 0',
                          background: 'transparent',
                          border: '1px solid rgba(0,212,170,0.28)',
                          color: shareCopied ? '#00d4aa' : '#e8ecf1',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {shareCopied ? 'Copied share note' : 'Copy share note'}
                      </button>
                      <Link
                        to={shareVerifyUrl}
                        style={{
                          padding: '12px 0',
                          textAlign: 'center',
                          background: '#00d4aa',
                          color: '#050a0f',
                          textDecoration: 'none',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        Open landlord view →
                      </Link>
                    </div>
                    <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#050a0f', border: '1px solid rgba(136,153,170,0.08)' }}>
                      <div style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Landlord verify link
                      </div>
                      <div style={{ fontSize: '10px', color: '#00d4aa', wordBreak: 'break-all', lineHeight: 1.6 }}>
                        {shareVerifyAbsoluteUrl}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '10px', color: '#556677', lineHeight: 1.6 }}>
                        This link keeps the proof context, but the landlord must paste your wallet address manually.
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#556677', wordBreak: 'break-word', lineHeight: 1.6 }}>
                      {shareMessage}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                    {txHash && (
                      <a href={explorerTxUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#00d4aa', textDecoration: 'underline' }}>
                        View transaction on Stellar Expert ↗
                      </a>
                    )}
                    {walletAddress && (
                      <a href={explorerAccountUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#00d4aa', textDecoration: 'underline' }}>
                        View wallet on Stellar Expert ↗
                      </a>
                    )}
                    {CONTRACT_ID && (
                      <a href={explorerContractUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: '#00d4aa', textDecoration: 'underline' }}>
                        View attestation contract on Stellar Expert ↗
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Link
                      to={shareVerifyUrl}
                      style={{
                        flex: 1,
                        padding: '13px 0',
                        textAlign: 'center',
                        background: '#00d4aa',
                        color: '#050a0f',
                        textDecoration: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      Landlord Verify →
                    </Link>
                    <button
                      onClick={() => { setStage('idle'); setPrivateValue(''); setTxHash(''); setLog(''); setShareCopied(false); setWalletCopied(false); setVerifyLinkCopied(false); }}
                      style={{
                        flex: 1,
                        padding: '13px 0',
                        background: 'transparent',
                        border: '1px solid rgba(136,153,170,0.2)',
                        color: '#8899aa',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      New Proof
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* In-progress stages */}
                  <div style={{ marginBottom: '32px' }}>
                    {/* Stage steps */}
                    <div style={{ display: 'flex', gap: '0', marginBottom: '28px' }}>
                      {(['commitment', 'proof', 'attest'] as const).map((s, i) => {
                        const stageOrder: Stage[] = ['idle', 'commitment', 'proof', 'attest', 'done', 'error'];
                        const currentIdx = stageOrder.indexOf(stage);
                        const thisIdx = stageOrder.indexOf(s);
                        const isDone = currentIdx > thisIdx;
                        const isActive = currentIdx === thisIdx;
                        const stageNames = ['1. Seal Data', '2. Generate Proof', '3. Record On-Chain'];
                        return (
                          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            {i < 2 && (
                              <div style={{
                                position: 'absolute',
                                top: '15px',
                                left: '50%',
                                right: '-50%',
                                height: '1px',
                                background: isDone ? '#00d4aa' : 'rgba(136,153,170,0.15)',
                                zIndex: 0,
                              }} />
                            )}
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: isDone ? '#00d4aa' : isActive ? 'rgba(0,212,170,0.15)' : '#050a0f',
                              border: `1px solid ${isDone ? '#00d4aa' : isActive ? '#00d4aa' : 'rgba(136,153,170,0.2)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              color: isDone ? '#050a0f' : isActive ? '#00d4aa' : '#556677',
                              fontWeight: 700,
                              zIndex: 1,
                              position: 'relative',
                              animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
                            }}>
                              {isDone ? '✓' : i + 1}
                            </div>
                            <div style={{ fontSize: '9px', color: isActive ? '#00d4aa' : isDone ? '#00d4aa' : '#445566', marginTop: '6px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {stageNames[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: '2px', background: 'rgba(0,212,170,0.08)', marginBottom: '20px' }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #00d4aa, #00aaff)',
                        width: `${progress}%`,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>

                    {/* Status message */}
                    <div style={{ fontSize: '12px', color: '#8899aa', lineHeight: 1.7, minHeight: '42px' }}>
                      <span style={{ color: '#00d4aa', marginRight: '8px' }}>›</span>
                      {log || STAGE_LABELS[stage]}
                    </div>
                  </div>

                  {/* Spinner dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#00d4aa',
                          opacity: 0.6,
                          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>

                  {txHash && (
                    <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.18)' }}>
                      <div style={{ fontSize: '10px', color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        Testnet transaction
                      </div>
                      <div style={{ fontSize: '11px', color: '#e8ecf1', wordBreak: 'break-all', lineHeight: 1.7, marginBottom: '10px' }}>
                        {txHash}
                      </div>
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '11px', color: '#00d4aa', textDecoration: 'underline' }}
                      >
                        Open live transaction on StellarExpert ↗
                      </a>
                    </div>
                  )}

                  <div style={{ marginTop: '24px', fontSize: '10px', color: '#334455', textAlign: 'center' }}>
                    Your private data stays in your browser throughout this process.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footnote */}
          {(stage === 'idle' || stage === 'error') && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '24px' }}>
              <Link
                to="/facility/verify"
                style={{ fontSize: '10px', color: '#556677', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Landlord Verify →
              </Link>
              <Link
                to="/"
                style={{ fontSize: '10px', color: '#556677', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                ← Home
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,170,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0,212,170,0); }
        }
      `}</style>
    </div>
  );
}
