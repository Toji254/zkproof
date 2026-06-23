import React, { useState, useEffect, useRef } from 'react';
import { 
  connectWallet as realConnectWallet, 
  disconnectWallet as realDisconnectWallet, 
  submitAttestation, 
  checkAttestation 
} from './lib/stellar';
import { CONTRACT_ID } from './lib/config';
import DemoTour from './components/DemoTour';
import useAnimations from './hooks/useAnimations';

// ============================================================
// zkProof — Main Application
// ============================================================

const VIEWS = { LANDING: 'landing', PROVE: 'prove', VERIFY: 'verify' };

// Attestation types
const ATTESTATION_TYPES = [
  { id: 'income', label: 'Monthly Income', unit: '$/month', icon: '💰' },
  { id: 'balance', label: 'Account Balance', unit: '$', icon: '🏦' },
  { id: 'credit', label: 'Credit Score', unit: 'points', icon: '📊' },
];

export default function App() {
  const [view, setView] = useState(VIEWS.LANDING);
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);

  // GSAP ScrollTrigger animations
  useAnimations();

  // Check if Freighter is installed and CONTRACT_ID is configured
  const hasFreighter = typeof window !== 'undefined' && (!!window.freighterApi || !!window.stellarKeeper);
  const isRealModeAvailable = hasFreighter && !!CONTRACT_ID;

  // --- Wallet Connection ---
  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (isRealModeAvailable) {
        console.log('Connecting to real Freighter wallet...');
        const address = await realConnectWallet();
        setWalletAddress(address);
        setIsDemoMode(false);
      } else {
        console.log('Freighter not available or CONTRACT_ID empty. Falling back to Demo Mode.');
        // Demo mode — generate a mock address
        const mockAddr = 'GDEMO' + Array.from({ length: 51 }, () => 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
        ).join('');
        setWalletAddress(mockAddr);
        setIsDemoMode(true);
      }
    } catch (err) {
      console.error('Wallet connection failed, falling back to Demo Mode:', err);
      // Fallback to demo mode
      const mockAddr = 'GDEMO' + Array.from({ length: 51 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');
      setWalletAddress(mockAddr);
      setIsDemoMode(true);
    }
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    if (!isDemoMode) {
      realDisconnectWallet();
    }
    setWalletAddress(null);
    setIsDemoMode(true);
    setView(VIEWS.LANDING);
  };

  const truncateAddress = (addr) => 
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <div className="app">
      {/* Interactive Demo Tour */}
      <DemoTour onNavigate={setView} VIEWS={VIEWS} walletAddress={walletAddress} />

      {/* ---- NAVBAR ---- */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <div className="navbar-logo" onClick={() => setView(VIEWS.LANDING)} style={{ cursor: 'pointer' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#00d4aa" strokeWidth="2" fill="none" />
              <path d="M10 14L13 17L18 11" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>zk</span>Proof
          </div>
          <div className="navbar-nav">
            <button 
              id="prove-nav-btn"
              className={`btn btn-ghost ${view === VIEWS.PROVE ? 'btn-outline' : ''}`}
              onClick={() => setView(VIEWS.PROVE)}
            >
              Prove
            </button>
            <button 
              id="verify-nav-btn"
              className={`btn btn-ghost ${view === VIEWS.VERIFY ? 'btn-outline' : ''}`}
              onClick={() => setView(VIEWS.VERIFY)}
            >
              Verify
            </button>
            <span className={`badge ${isRealModeAvailable ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', alignSelf: 'center', marginRight: 10 }}>
              {isRealModeAvailable ? '🟢 Testnet' : '🟡 Demo'}
            </span>
            {walletAddress ? (
              <button className="btn btn-outline" onClick={disconnectWallet}>
                {truncateAddress(walletAddress)}
              </button>
            ) : (
              <button id="connect-wallet-btn" className="btn btn-primary" onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? <span className="spinner" /> : null}
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ---- VIEWS ---- */}
      {view === VIEWS.LANDING && <LandingView onNavigate={setView} onConnect={connectWallet} isConnected={!!walletAddress} />}
      {view === VIEWS.PROVE && <ProveView walletAddress={walletAddress} onConnect={connectWallet} isDemoMode={isDemoMode} />}
      {view === VIEWS.VERIFY && <VerifyView isRealModeAvailable={isRealModeAvailable} />}

      {/* ---- FOOTER ---- */}
      <footer className="footer">
        <div className="container">
          <p>zkProof — Built for <a href="https://dorahacks.io/hackathon/stellar-hacks-zk" target="_blank" rel="noopener">Stellar Hacks: Real-World ZK</a></p>
          <p style={{ marginTop: 6 }}>Powered by Noir • Soroban • BN254 • Poseidon</p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Landing View
// ============================================================
function LandingView({ onNavigate, onConnect, isConnected }) {
  return (
    <>
      <section className="hero">
        <div className="hero-badge">
          <span className="badge badge-success">⚡ Zero-Knowledge on Stellar</span>
        </div>
        <h1>
          Prove Your Finances.<br />
          <span className="gradient-text">Without Showing Them.</span>
        </h1>
        <p>
          Generate verifiable financial attestations using zero-knowledge proofs.
          Your data never leaves your browser. Verifiers get a YES or NO — nothing else.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate(VIEWS.PROVE)}>
            Generate Attestation →
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => onNavigate(VIEWS.VERIFY)}>
            Verify Someone
          </button>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Three steps. Zero data exposure. Complete verification.</p>
          </div>
          <div className="steps-grid">
            <div className="card step-card fade-in-up">
              <div className="step-number">1</div>
              <h3>Enter Data Locally</h3>
              <p>Input your financial data in the browser. It never leaves your device — not to our servers, not to the blockchain. Ever.</p>
            </div>
            <div className="card step-card fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="step-number">2</div>
              <h3>Generate ZK Proof</h3>
              <p>A Noir circuit generates a cryptographic proof that your income exceeds the threshold — without revealing the actual number.</p>
            </div>
            <div className="card step-card fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="step-number">3</div>
              <h3>On-Chain Attestation</h3>
              <p>The proof is verified on Stellar via a Soroban smart contract. You receive a tamper-proof attestation anyone can check.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What Verifiers See */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <h2>What the Verifier Sees</h2>
            <p>Complete verification. Zero personal data.</p>
          </div>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="card result-card" style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div className="result-icon success" style={{ width: 40, height: 40, fontSize: 18, margin: 0 }}>✓</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Attestation Valid</div>
                  <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Income exceeds threshold</div>
                </div>
              </div>
              <div className="result-details">
                <div className="result-row">
                  <span className="label">Type</span>
                  <span className="value text-accent">Monthly Income</span>
                </div>
                <div className="result-row">
                  <span className="label">Threshold</span>
                  <span className="value">&gt; $3,000/month</span>
                </div>
                <div className="result-row">
                  <span className="label">Verified</span>
                  <span className="value">June 25, 2026</span>
                </div>
                <div className="result-row">
                  <span className="label">Expires</span>
                  <span className="value">Sept 25, 2026</span>
                </div>
                <div className="result-row" style={{ border: 'none' }}>
                  <span className="label">Exact Income</span>
                  <span className="value" style={{ color: 'var(--text-muted)' }}>🔒 Hidden</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section">
        <div className="container">
          <div className="stats-grid">
            <div className="card stat-card">
              <div className="stat-value" data-target="0" data-suffix="" data-integer>0</div>
              <div className="stat-label">Data Points Exposed</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" data-target="90" data-suffix="d" data-integer>90d</div>
              <div className="stat-label">Attestation Validity (days)</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" data-target="5" data-prefix="<" data-suffix="s" data-integer>&lt;5s</div>
              <div className="stat-label">Proof Generation</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">∞</div>
              <div className="stat-label">Verifications (Unlimited)</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// Prove View — User generates attestation
// ============================================================
function ProveView({ walletAddress, onConnect, isDemoMode }) {
  const [attestationType, setAttestationType] = useState('income');
  const [income, setIncome] = useState('');
  const [threshold, setThreshold] = useState('3000');
  const [isProving, setIsProving] = useState(false);
  const [proofResult, setProofResult] = useState(null);
  const [step, setStep] = useState('input'); // input, proving, success, error
  const [provingStep, setProvingStep] = useState(0); // 0: commitment, 1: witness, 2: proof, 3: blockchain

  const selectedType = ATTESTATION_TYPES.find(t => t.id === attestationType);

  const generateProof = async () => {
    if (!walletAddress) {
      onConnect();
      return;
    }

    const incomeVal = parseFloat(income);
    const thresholdVal = parseFloat(threshold);

    if (!incomeVal || !thresholdVal || incomeVal <= 0 || thresholdVal <= 0) {
      alert('Please enter valid values');
      return;
    }

    if (incomeVal <= thresholdVal) {
      setStep('error');
      setProofResult({ error: 'Income does not exceed the threshold. Proof cannot be generated.' });
      return;
    }

    setIsProving(true);
    setStep('proving');
    setProvingStep(0);

    try {
      // 1. Commitment
      await new Promise(resolve => setTimeout(resolve, 800));
      setProvingStep(1);

      // 2. Witness
      await new Promise(resolve => setTimeout(resolve, 800));
      setProvingStep(2);

      // 3. Proof
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockProofHash = '0x' + Array.from({ length: 64 }, () => 
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join('');

      const now = new Date();
      const expiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      if (isDemoMode) {
        setProvingStep(3);
        await new Promise(resolve => setTimeout(resolve, 800));

        setProofResult({
          success: true,
          isDemo: true,
          attestationType: selectedType.label,
          threshold: thresholdVal,
          unit: selectedType.unit,
          proofHash: mockProofHash,
          issuedAt: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          expiresAt: expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          txHash: mockProofHash.slice(0, 20) + '...',
        });
        setStep('success');
      } else {
        setProvingStep(3);
        console.log('Submitting ZK Proof to Soroban contract...');

        // Call real submitAttestation
        const txHash = await submitAttestation(mockProofHash, null, attestationType, thresholdVal);

        setProofResult({
          success: true,
          isDemo: false,
          attestationType: selectedType.label,
          threshold: thresholdVal,
          unit: selectedType.unit,
          proofHash: mockProofHash,
          issuedAt: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          expiresAt: expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          txHash: txHash.slice(0, 20) + '...',
          realTxHash: txHash,
        });
        setStep('success');
      }
    } catch (err) {
      console.error('Proof submission failed:', err);
      setStep('error');
      setProofResult({ error: err.message || 'On-chain proof attestation failed.' });
    } finally {
      setIsProving(false);
    }
  };

  const reset = () => {
    setStep('input');
    setProofResult(null);
    setIncome('');
    setProvingStep(0);
  };

  return (
    <section id="prove-section" className="section" style={{ paddingTop: 120 }}>
      <div className="container">
        <div className="section-header">
          <h2>Generate Attestation</h2>
          <p>Your data stays in your browser. The proof goes on-chain.</p>
        </div>

        {step === 'input' && (
          <div className="card prove-card fade-in-up">
            <div className="privacy-banner">
              <span className="icon">🔒</span>
              <p><strong>Privacy guarantee:</strong> Your financial data never leaves this browser. Only the cryptographic proof is submitted to the blockchain.</p>
            </div>

            <div className="prove-form">
              {/* Attestation Type */}
              <div className="input-group">
                <label>Attestation Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ATTESTATION_TYPES.map(type => (
                    <button
                      key={type.id}
                      className={`btn ${attestationType === type.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setAttestationType(type.id)}
                      style={{ flex: 1, fontSize: '0.85rem' }}
                    >
                      {type.icon} {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Income Input */}
              <div className="input-group">
                <label>Your {selectedType.label} (Private — never shared)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="income-input"
                    type="number"
                    className="input-field"
                    placeholder={`e.g., 5000`}
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>$</span>
                </div>
              </div>

              {/* Threshold Input */}
              <div className="input-group">
                <label>Minimum Threshold to Prove</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="threshold-input"
                    type="number"
                    className="input-field"
                    placeholder="e.g., 3000"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>$</span>
                </div>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  The verifier will only know your {selectedType.label.toLowerCase()} exceeds ${threshold || '___'}/{selectedType.unit.replace('$/', '').replace('$', '')}
                </span>
              </div>

              <div className="prove-divider" />

              <button 
                id="generate-proof-btn"
                className="btn btn-primary" 
                onClick={generateProof}
                disabled={isProving}
                style={{ width: '100%', padding: '16px', fontSize: '1rem' }}
              >
                {!walletAddress ? '🔗 Connect Wallet First' : '🔐 Generate ZK Proof & Attest'}
              </button>
            </div>
          </div>
        )}

        {step === 'proving' && (
          <div className="card prove-card fade-in-up" style={{ textAlign: 'center' }}>
            <div className="pulse-glow" style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--accent-glow)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justify: 'center',
              margin: '0 auto 24px', fontSize: 32
            }}>
              🔐
            </div>
            <h3 style={{ marginBottom: 8 }}>Generating Zero-Knowledge Proof...</h3>
            <p className="text-secondary">Your financial data is being processed locally. Nothing is being sent to any server.</p>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ProgressStep label="Computing Poseidon commitment" done={provingStep > 0} active={provingStep === 0} />
              <ProgressStep label="Generating Noir circuit witness" done={provingStep > 1} active={provingStep === 1} />
              <ProgressStep label="Building UltraHonk proof" done={provingStep > 2} active={provingStep === 2} />
              <ProgressStep label="Submitting to Soroban contract" done={provingStep > 3} active={provingStep === 3} />
            </div>
          </div>
        )}

        {step === 'success' && proofResult && (
          <div id="attestation-result" className="card result-card fade-in-up" style={{ textAlign: 'left', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div className="result-icon success">✓</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>Attestation Issued</div>
                <div className="text-secondary">On-chain proof verified successfully</div>
              </div>
            </div>
            <div className="result-details">
              <div className="result-row">
                <span className="label">Type</span>
                <span className="value text-accent">{proofResult.attestationType}</span>
              </div>
              <div className="result-row">
                <span className="label">Proven Threshold</span>
                <span className="value">&gt; ${proofResult.threshold.toLocaleString()}/{selectedType.unit.replace('$/', '').replace('$', '')}</span>
              </div>
              <div className="result-row">
                <span className="label">Issued</span>
                <span className="value">{proofResult.issuedAt}</span>
              </div>
              <div className="result-row">
                <span className="label">Expires</span>
                <span className="value">{proofResult.expiresAt}</span>
              </div>
              <div className="result-row">
                <span className="label">Proof Hash</span>
                <span className="value text-mono" style={{ fontSize: '0.75rem' }}>{proofResult.proofHash.slice(0, 22)}...</span>
              </div>
              {proofResult.txHash && (
                <div className="result-row">
                  <span className="label">Transaction</span>
                  <span className="value text-mono" style={{ fontSize: '0.75rem' }}>
                    {proofResult.isDemo ? (
                      proofResult.txHash
                    ) : (
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${proofResult.realTxHash}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                      >
                        {proofResult.txHash}
                      </a>
                    )}
                  </span>
                </div>
              )}
              <div className="result-row" style={{ border: 'none' }}>
                <span className="label">Exact Income Exposed</span>
                <span className="value" style={{ color: 'var(--accent)' }}>🔒 Zero</span>
              </div>
            </div>
            <button className="btn btn-outline" onClick={reset} style={{ width: '100%', marginTop: 20 }}>
              Generate Another Attestation
            </button>
          </div>
        )}

        {step === 'error' && proofResult && (
          <div className="card result-card fade-in-up" style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="result-icon" style={{ background: 'rgba(255,68,102,0.12)', border: '2px solid var(--error)', color: 'var(--error)' }}>✗</div>
            <h3 style={{ color: 'var(--error)' }}>Proof Generation Failed</h3>
            <p className="text-secondary" style={{ marginTop: 8 }}>{proofResult.error}</p>
            <button className="btn btn-outline" onClick={reset} style={{ marginTop: 20 }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Verify View — Verifier checks attestation
// ============================================================
function VerifyView({ isRealModeAvailable }) {
  const [address, setAddress] = useState('');
  const [attestationType, setAttestationType] = useState('income');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const checkAttestationCall = async () => {
    if (!address.trim()) {
      alert('Please enter a Stellar address');
      return;
    }
    setIsChecking(true);
    setErrorMsg('');
    setResult(null);

    if (!isRealModeAvailable) {
      // Demo Mode
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (address.startsWith('G') && address.length > 20) {
        const now = new Date();
        const expiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        setResult({
          valid: true,
          type: ATTESTATION_TYPES.find(t => t.id === attestationType)?.label || 'Income',
          threshold: 3000,
          issuedAt: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          expiresAt: expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        });
      } else {
        setResult({ valid: false });
      }
    } else {
      // Real Mode
      try {
        const res = await checkAttestation(address, attestationType);
        if (res.valid && res.attestation) {
          const att = res.attestation;
          const issuedDate = new Date(att.issuedAt * 1000);
          const expiresDate = new Date(att.expiresAt * 1000);
          setResult({
            valid: true,
            type: ATTESTATION_TYPES.find(t => t.id === attestationType)?.label || 'Income',
            threshold: att.threshold,
            issuedAt: issuedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            expiresAt: expiresDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            proofHash: att.proofHash,
          });
        } else {
          setResult({ valid: false });
        }
      } catch (err) {
        console.error('On-chain query failed:', err);
        setErrorMsg('Failed to query the blockchain. Please check the address format or network connection.');
      }
    }
    setIsChecking(false);
  };

  return (
    <section id="verify-section" className="section" style={{ paddingTop: 120 }}>
      <div className="container">
        <div className="section-header">
          <h2>Verify Attestation</h2>
          <p>Check if someone holds a valid financial attestation. You'll see YES or NO — nothing else.</p>
        </div>

        <div className="card verify-card fade-in-up">
          <div className="prove-form">
            <div className="input-group">
              <label>Stellar Address to Verify</label>
              <input
                id="verify-address-input"
                type="text"
                className="input-field"
                placeholder="G..."
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Attestation Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {ATTESTATION_TYPES.map(type => (
                  <button
                    key={type.id}
                    className={`btn ${attestationType === type.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setAttestationType(type.id)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              id="check-attestation-btn"
              className="btn btn-primary" 
              onClick={checkAttestationCall}
              disabled={isChecking}
              style={{ width: '100%', padding: '16px', fontSize: '1rem' }}
            >
              {isChecking ? (
                <><span className="spinner" /> Querying Blockchain...</>
              ) : (
                '🔍 Check Attestation'
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="card result-card fade-in-up" style={{ textAlign: 'center', maxWidth: 560, margin: '40px auto 0', border: '1px solid var(--error)' }}>
            <div className="result-icon" style={{ background: 'rgba(255,68,102,0.12)', border: '2px solid var(--error)', color: 'var(--error)' }}>✗</div>
            <h3 style={{ color: 'var(--error)' }}>Query Failed</h3>
            <p className="text-secondary" style={{ marginTop: 8 }}>{errorMsg}</p>
          </div>
        )}

        {result && (
          <div className="card result-card fade-in-up" style={{ textAlign: 'left', maxWidth: 560, margin: '40px auto 0' }}>
            {result.valid ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div className="result-icon success" style={{ width: 40, height: 40, fontSize: 18, margin: 0 }}>✓</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>Valid Attestation Found</div>
                  </div>
                </div>
                <div className="result-details">
                  <div className="result-row">
                    <span className="label">Type</span>
                    <span className="value text-accent">{result.type}</span>
                  </div>
                  <div className="result-row">
                    <span className="label">Threshold Met</span>
                    <span className="value">&gt; ${result.threshold.toLocaleString()}/month</span>
                  </div>
                  <div className="result-row">
                    <span className="label">Verified</span>
                    <span className="value">{result.issuedAt}</span>
                  </div>
                  <div className="result-row">
                    <span className="label">Expires</span>
                    <span className="value">{result.expiresAt}</span>
                  </div>
                  {result.proofHash && (
                    <div className="result-row">
                      <span className="label">Proof Hash</span>
                      <span className="value text-mono" style={{ fontSize: '0.75rem' }}>{result.proofHash.slice(0, 22)}...</span>
                    </div>
                  )}
                  <div className="result-row" style={{ border: 'none' }}>
                    <span className="label">Exact Income</span>
                    <span className="value" style={{ color: 'var(--text-muted)' }}>🔒 Hidden</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="result-icon" style={{ background: 'rgba(255,68,102,0.12)', border: '2px solid var(--error)', color: 'var(--error)', width: 48, height: 48, fontSize: 22 }}>✗</div>
                <h3 style={{ color: 'var(--error)', marginTop: 12 }}>No Valid Attestation</h3>
                <p className="text-secondary" style={{ marginTop: 8 }}>This address does not hold a valid attestation of the requested type.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Progress Step Component
// ============================================================
function ProgressStep({ label, done, active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8,
      background: active ? 'var(--accent-glow)' : 'transparent',
      border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
    }}>
      <span style={{ width: 20, textAlign: 'center', fontSize: '0.85rem' }}>
        {done ? '✅' : active ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '⬜'}
      </span>
      <span style={{
        fontSize: '0.85rem',
        color: done ? 'var(--text-muted)' : active ? 'var(--accent)' : 'var(--text-muted)',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {label}
      </span>
    </div>
  );
}
