import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TOUR_STORAGE_KEY = 'zkproof_tour_completed';

interface TourStep {
  title: string;
  description: string;
  targetId: string | null;
  path: string;
  action?: (walletAddress?: string) => void;
}

interface DemoTourProps {
  walletAddress: string;
}

export default function DemoTour({ walletAddress }: DemoTourProps) {
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const navigate = useNavigate();

  const STEPS: TourStep[] = [
    {
      title: "👋 Welcome to ProofPass",
      description: "This tour walks through private rental qualification: the renter proves they qualify, and the landlord sees only the answer they need.",
      targetId: null,
      path: '/',
    },
    {
      title: "🔗 Connect Your Wallet",
      description: "First, connect a Stellar wallet. The wallet anchors the on-chain attestation, but the renter's private financial input stays in the browser.",
      targetId: "#connect-wallet-btn",
      path: '/',
    },
    {
      title: "🏠 Renter enters private income",
      description: "Enter the renter's private income. This value stays in the browser and is used only to create the private commitment and proof.",
      targetId: "#income-input",
      path: '/facility/enter-data',
      action: () => {
        const incomeInput = document.querySelector("#income-input") as HTMLInputElement;
        if (incomeInput) {
          incomeInput.value = "5000";
          const tracker = (incomeInput as any)._valueTracker;
          if (tracker) tracker.setValue("");
          incomeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    {
      title: "🎯 Set the landlord requirement",
      description: "Specify the public requirement the renter wants to satisfy, for example monthly income of at least 3,000.",
      targetId: "#threshold-input",
      path: '/facility/generate-proof',
      action: () => {
        const thresholdInput = document.querySelector("#threshold-input") as HTMLInputElement;
        if (thresholdInput) {
          thresholdInput.value = "3000";
          const tracker = (thresholdInput as any)._valueTracker;
          if (tracker) tracker.setValue("");
          thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    {
      title: "🔐 Generate the private proof",
      description: "Click here to generate the zero-knowledge proof locally in the browser. The landlord will later verify the result without seeing the renter's actual income.",
      targetId: "#generate-proof-btn",
      path: '/facility/generate-proof',
    },
    {
      title: "🔍 Switch to landlord view",
      description: "Now switch to the landlord verifier screen. This is the non-crypto view that checks the attestation on Stellar.",
      targetId: "#verify-nav-btn",
      path: '/facility/generate-proof',
    },
    {
      title: "✅ Landlord verifies qualification",
      description: "Paste the renter address and check the requirement type. The verifier gets only the qualification result, threshold, and expiry date.",
      targetId: "#check-attestation-btn",
      path: '/facility/verify',
      action: (address) => {
        const addressInput = document.querySelector("#verify-address-input") as HTMLInputElement;
        if (addressInput) {
          addressInput.value = address || "GDEMO" + Array.from({ length: 51 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('');
          const tracker = (addressInput as any)._valueTracker;
          if (tracker) tracker.setValue("");
          addressInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  ];

  useEffect(() => {
    const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!isCompleted) {
      setTimeout(() => {
        setActiveStep(0);
      }, 1500);
    }
  }, []);

  useEffect(() => {
    if (activeStep < 0) return;
    const step = STEPS[activeStep];

    // Navigate to the correct view if specified
    if (step.path) {
      navigate(step.path);
    }

    let timer: number;
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
        checkCount++;
        if (checkCount < 20) {
          timer = window.setTimeout(updatePosition, 100);
        } else {
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

      if (step.action) {
        step.action(walletAddress);
      }
    };

    // Delay checking position slightly to let page navigation complete
    timer = window.setTimeout(updatePosition, 150);

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
          bottom: 24,
          right: 24,
          zIndex: 100,
          background: 'rgba(0, 212, 170, 0.15)',
          border: '1px solid rgba(0, 212, 170, 0.25)',
          color: '#00d4aa',
          padding: '10px 20px',
          borderRadius: 30,
          fontSize: '0.8rem',
          fontFamily: "'IBM Plex Mono', monospace",
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 212, 170, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 212, 170, 0.15)';
        }}
      >
        <span>💡</span> Show Guide Tour
      </button>
    );
  }

  const currentStepData = STEPS[activeStep];

  return (
    <>
      <div 
        className="tour-overlay" 
        onClick={skipTour} 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          zIndex: 9997,
        }}
      />

      <div 
        className="tour-highlight" 
        style={{
          ...highlightStyle,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 15px #00d4aa',
          borderRadius: 6,
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
        }} 
      />

      <div 
        className="tour-tooltip glass-card" 
        style={{
          ...tooltipStyle,
          width: '320px',
          padding: '20px',
          background: '#0d1620',
          border: '1px solid #00d4aa',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
          fontFamily: "'IBM Plex Mono', monospace",
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.75rem', color: '#00d4aa', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            STEP {activeStep + 1} OF {STEPS.length}
          </span>
          {autoPlay && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(0, 212, 170, 0.15)', color: '#00d4aa', padding: '2px 8px', borderRadius: 10 }}>
              ▶ Auto-Play
            </span>
          )}
        </div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#e8ecf1', fontWeight: 600, textTransform: 'uppercase' }}>
          {currentStepData.title}
        </h4>
        <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: '#8899aa', lineHeight: '1.5' }}>
          {currentStepData.description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={skipTour} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#556677', 
              fontSize: '0.75rem', 
              cursor: 'pointer',
              textDecoration: 'underline' 
            }}
          >
            Skip
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={handleBack} 
              disabled={activeStep === 0}
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.75rem', 
                background: 'transparent',
                border: '1px solid rgba(136, 153, 170, 0.2)',
                color: activeStep === 0 ? '#556677' : '#8899aa',
                cursor: activeStep === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Back
            </button>
            <button 
              onClick={activeStep === STEPS.length - 1 ? handleFinish : handleNext}
              style={{ 
                padding: '6px 14px', 
                fontSize: '0.75rem', 
                background: '#00d4aa', 
                border: 'none', 
                color: '#050a0f', 
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {activeStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(136, 153, 170, 0.12)', paddingTop: 10, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={() => setAutoPlay(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              color: autoPlay ? '#00d4aa' : '#556677',
              fontSize: '0.72rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: "'IBM Plex Mono', monospace"
            }}
          >
            {autoPlay ? '⏸ Pause Auto-Advance' : '▶ Enable Auto-Play (For Demos)'}
          </button>
        </div>
      </div>
    </>
  );
}
