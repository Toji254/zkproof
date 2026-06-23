import React, { useState, useEffect } from 'react';

const TOUR_STORAGE_KEY = 'zkproof_tour_completed';

export default function DemoTour({ onNavigate, VIEWS, walletAddress }) {
  const [activeStep, setActiveStep] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [highlightStyle, setHighlightStyle] = useState({});

  const STEPS = [
    {
      title: "👋 Welcome to zkProof!",
      description: "This interactive tour will guide you through proving and verifying financial eligibility on-chain using Zero-Knowledge proofs and Soroban smart contracts.",
      targetId: null,
      view: 'landing',
    },
    {
      title: "🔗 Connect Your Wallet",
      description: "First, connect your Stellar Freighter wallet. If you don't have it, the application will automatically run in Demo Mode with a mock wallet address.",
      targetId: "#connect-wallet-btn",
      view: 'landing',
    },
    {
      title: "✍️ Enter Private Income Data",
      description: "Enter your private income. This sensitive value is processed entirely in your browser to compute a Poseidon commitment—it is never exposed to any server or blockchain.",
      targetId: "#income-input",
      view: 'prove',
      action: () => {
        const incomeInput = document.querySelector("#income-input");
        if (incomeInput) {
          incomeInput.value = "5000";
          const tracker = incomeInput._valueTracker;
          if (tracker) tracker.setValue("");
          incomeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    {
      title: "🎯 Set Proven Threshold",
      description: "Specify the minimum threshold you wish to prove (e.g. $3,000). The ZK proof will verify that your income exceeds this amount, while keeping the exact value hidden.",
      targetId: "#threshold-input",
      view: 'prove',
      action: () => {
        const thresholdInput = document.querySelector("#threshold-input");
        if (thresholdInput) {
          thresholdInput.value = "3000";
          const tracker = thresholdInput._valueTracker;
          if (tracker) tracker.setValue("");
          thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    {
      title: "🔐 Generate ZK Proof & Attest",
      description: "Click this button to compile the witness locally in your browser, generate the UltraHonk ZK proof, and submit the attestation to our Soroban smart contract.",
      targetId: "#generate-proof-btn",
      view: 'prove',
    },
    {
      title: "🔍 Switch to Verifier View",
      description: "Let's switch to the Verifier view. In this screen, third-parties (e.g., landlords, lenders) can verify your proof credentials on-chain.",
      targetId: "#verify-nav-btn",
      view: 'prove',
    },
    {
      title: "✅ Verify the Attestation",
      description: "Paste a Stellar address and select the attestation type to check. The smart contract queries the ledger and returns a simple YES or NO—zero private details are leaked.",
      targetId: "#check-attestation-btn",
      view: 'verify',
      action: (address) => {
        const addressInput = document.querySelector("#verify-address-input");
        if (addressInput) {
          addressInput.value = address || "GDEMO" + Array.from({ length: 51 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('');
          const tracker = addressInput._valueTracker;
          if (tracker) tracker.setValue("");
          addressInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  ];

  useEffect(() => {
    const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!isCompleted) {
      // Start tour automatically on first visit
      setTimeout(() => {
        setActiveStep(0);
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (activeStep < 0) return;
    const step = STEPS[activeStep];

    // Navigate to the correct view if specified
    if (step.view) {
      onNavigate(step.view.toUpperCase());
    }

    let timer;
    let checkCount = 0;

    const updatePosition = () => {
      if (!step.targetId) {
        setTooltipStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
        });
        setHighlightStyle({ display: 'none' });
        return;
      }

      const el = document.querySelector(step.targetId);
      if (!el) {
        // Element may not be rendered yet; retry polling
        checkCount++;
        if (checkCount < 20) {
          timer = setTimeout(updatePosition, 100);
        } else {
          // Fallback to center if not found
          setTooltipStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10000,
          });
          setHighlightStyle({ display: 'none' });
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      setHighlightStyle({
        position: 'absolute',
        top: rect.top + window.scrollY - 4,
        left: rect.left + window.scrollX - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        zIndex: 9998,
        display: 'block',
      });

      let top = rect.bottom + window.scrollY + 12;
      let left = rect.left + window.scrollX + rect.width / 2;
      let transform = 'translateX(-50%)';

      // Keep tooltip visible inside bounds
      if (top + 200 > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - 180;
      }
      if (left + 150 > window.innerWidth) {
        left = window.innerWidth - 170;
        transform = 'none';
      } else if (left - 150 < 0) {
        left = 20;
        transform = 'none';
      }

      setTooltipStyle({
        position: 'absolute',
        top,
        left,
        transform,
        zIndex: 9999,
      });

      // Run step action
      if (step.action) {
        step.action(walletAddress);
      }
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [activeStep]);

  useEffect(() => {
    if (!autoPlay || activeStep === -1) return;
    const interval = setInterval(() => {
      if (activeStep < STEPS.length - 1) {
        handleNext();
      } else {
        setAutoPlay(false);
        handleFinish();
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [autoPlay, activeStep]);

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(0, prev - 1));
  };

  const handleFinish = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setActiveStep(-1);
    setAutoPlay(false);
  };

  const skipTour = () => {
    handleFinish();
  };

  const startTourManually = () => {
    setActiveStep(0);
  };

  if (activeStep === -1) {
    return (
      <button 
        onClick={startTourManually} 
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 100,
          background: 'var(--accent-glow)',
          border: '1px solid var(--border-accent)',
          color: 'var(--accent)',
          padding: '8px 16px',
          borderRadius: 30,
          fontSize: '0.8rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span>💡</span> Show Guide Tour
      </button>
    );
  }

  const currentStepData = STEPS[activeStep];

  return (
    <>
      {/* Tour overlay/backdrop */}
      <div className="tour-overlay" onClick={skipTour} />

      {/* Target element highlight */}
      <div className="tour-highlight" style={highlightStyle} />

      {/* Tooltip Card */}
      <div className="tour-tooltip card" style={tooltipStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>
            STEP {activeStep + 1} OF {STEPS.length}
          </span>
          {autoPlay && (
            <span style={{ fontSize: '0.75rem', background: 'var(--success-glow)', color: 'var(--success)', padding: '2px 8px', borderRadius: 10 }}>
              ▶ Auto-Play
            </span>
          )}
        </div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--text)' }}>
          {currentStepData.title}
        </h4>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {currentStepData.description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={skipTour} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Skip
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              className="btn btn-outline" 
              onClick={handleBack} 
              disabled={activeStep === 0}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Back
            </button>
            <button 
              className="btn btn-primary" 
              onClick={activeStep === STEPS.length - 1 ? handleFinish : handleNext}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {activeStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={() => setAutoPlay(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              color: autoPlay ? 'var(--success)' : 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {autoPlay ? '⏸ Pause Auto-Advance' : '▶ Enable Auto-Play (For Demos)'}
          </button>
        </div>
      </div>
    </>
  );
}
