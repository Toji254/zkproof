import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
  title: string;
  description: string;
  targetId: string | null;
  path: string;
  scrollTo?: string;
  delay?: number;
  autoAdvanceMs?: number;
  action?: (addr: string) => void;
}

interface DemoTourProps {
  walletAddress: string;
}

const TOUR_STORAGE_KEY = 'zkproof_tour_completed';
const AUTO_ADVANCE_MS = 7000;

const STEPS: TourStep[] = [
  {
    title: 'Welcome to ProofPass',
    description:
      'ProofPass lets renters prove they qualify - income, savings, or credit score - without sharing the actual number. Built on Stellar with zero-knowledge cryptography.',
    targetId: null,
    path: '/',
    delay: 300,
    autoAdvanceMs: 6500,
  },
  {
    title: 'Connect Your Wallet',
    description:
      "Connect a Stellar wallet to sign the on-chain attestation. Your private financial data never leaves the browser - the wallet is only used at the final signing step.",
    targetId: '#connect-wallet-btn',
    path: '/',
    delay: 250,
  },
  {
    title: 'Why ProofPass Exists',
    description:
      'Traditional rental applications expose full bank statements and pay stubs. ProofPass replaces that with a cryptographic proof: a landlord gets a yes/no, never the raw number.',
    targetId: null,
    path: '/',
    scrollTo: 'manifesto-section',
    delay: 500,
    autoAdvanceMs: 7000,
  },
  {
    title: 'How It Works',
    description:
      'The renter enters data locally, generates a ZK proof, records an attestation on Stellar, and the landlord verifies - all without seeing raw numbers. Scroll down to explore each step.',
    targetId: null,
    path: '/',
    scrollTo: 'facilities-section',
    delay: 500,
    autoAdvanceMs: 7500,
  },
  {
    title: 'Prove You Qualify',
    description:
      "This is the renter view. Pick the qualification type, enter your private value, choose the landlord requirement, and hit one button. The app handles commitment, proof, and attestation automatically.",
    targetId: '#income-input',
    path: '/prove',
    delay: 600,
    autoAdvanceMs: 8000,
  },
  {
    title: 'Landlord Verification',
    description:
      "This is the landlord view. Paste the renter wallet address, choose the requirement type, and click Check. The landlord sees only QUALIFIED or NOT QUALIFIED - no salary, no bank data.",
    targetId: '#check-attestation-btn',
    path: '/facility/verify',
    delay: 500,
    autoAdvanceMs: 8000,
    action: (addr) => {
      if (!addr) return;
      const el = document.getElementById('verify-address-input') as HTMLInputElement | null;
      if (el && !el.value) el.value = addr;
    },
  },
  {
    title: "That's ProofPass",
    description:
      "Zero-knowledge rental qualification on Stellar. The renter data never leaves the browser. The landlord gets a tamper-proof yes/no. Privacy for the renter, certainty for the landlord.",
    targetId: null,
    path: '/facility/verify',
    delay: 200,
    autoAdvanceMs: 7000,
  },
];

export default function DemoTour({ walletAddress }: DemoTourProps) {
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<number>(0);
  const autoTimerRef = useRef<number>(0);

  // Auto-start on first visit
  useEffect(() => {
    const done = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    if (!done) {
      const t = window.setTimeout(() => {
        setActiveStep(0);
        setAutoPlay(true);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Bottom-right corner: non-intrusive, never covers UI
  const pinBottomRight = useCallback(
    (action?: (addr: string) => void) => {
      setTooltipStyle({
        position: 'fixed',
        bottom: 24,
        right: 24,
        top: 'auto',
        left: 'auto',
        transform: 'none',
        zIndex: 10001,
        opacity: 1,
      });
      setHighlightStyle({ display: 'none' });
      if (action) action(walletAddress);
    },
    [walletAddress],
  );

  // Position tooltip next to its target element, clamped fully on-screen
  const positionTooltip = useCallback(() => {
    if (activeStep < 0) return;
    const step = STEPS[activeStep];

    if (step.scrollTo) {
      const scrollEl = document.getElementById(step.scrollTo);
      if (scrollEl) scrollEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (!step.targetId) {
      pinBottomRight(step.action);
      return;
    }

    let attempts = 0;
    const tryPosition = () => {
      const el = document.querySelector(step.targetId!);
      if (!el) {
        attempts++;
        if (attempts < 25) {
          timerRef.current = window.setTimeout(tryPosition, 140);
        } else {
          pinBottomRight(step.action);
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;

      // Highlight ring
      setHighlightStyle({
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        zIndex: 9999,
        display: 'block',
      });

      const TW = 380;
      const TH = 260;

      let top = rect.bottom + 14;
      let left = rect.left + rect.width / 2 - TW / 2;

      // Flip above if clipped at bottom
      if (top + TH > H - 16) top = rect.top - TH - 14;
      if (top < 12) top = 12;

      // Clamp horizontal so tooltip never goes off-screen
      left = Math.max(12, Math.min(left, W - TW - 12));

      setTooltipStyle({
        position: 'fixed',
        top,
        left,
        transform: 'none',
        zIndex: 10001,
        opacity: 1,
      });

      if (step.action) step.action(walletAddress);
    };

    timerRef.current = window.setTimeout(tryPosition, step.delay ?? 200);
  }, [activeStep, walletAddress, pinBottomRight]);

  // Navigate + reposition on step change
  useEffect(() => {
    if (activeStep < 0) return;
    clearTimeout(timerRef.current);

    const step = STEPS[activeStep];
    setTooltipStyle((prev) => ({ ...prev, opacity: 0 }));

    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      timerRef.current = window.setTimeout(positionTooltip, (step.delay ?? 200) + 250);
    } else {
      timerRef.current = window.setTimeout(positionTooltip, step.delay ?? 200);
    }

    const handleReposition = () => positionTooltip();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition);
    };
  }, [activeStep, navigate, location.pathname, positionTooltip]);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setActiveStep(-1);
    setAutoPlay(false);
  }, []);

  const goNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep((p) => p + 1);
    else finish();
  };

  const goBack = () => setActiveStep((p) => Math.max(0, p - 1));

  // Auto-advance timer
  useEffect(() => {
    if (!autoPlay || activeStep < 0) return;
    const ms = STEPS[activeStep]?.autoAdvanceMs ?? AUTO_ADVANCE_MS;
    autoTimerRef.current = window.setTimeout(() => {
      if (activeStep < STEPS.length - 1) setActiveStep((p) => p + 1);
      else finish();
    }, ms);
    return () => clearTimeout(autoTimerRef.current);
  }, [autoPlay, activeStep, finish]);

  const startTour = () => {
    setActiveStep(0);
    setAutoPlay(true);
  };

  // Idle: persistent pill in bottom-right
  if (activeStep === -1) {
    return (
      <button
        onClick={startTour}
        aria-label="Start guided tour"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9000,
          background: 'rgba(8,14,20,0.92)',
          border: '1px solid rgba(0,212,170,0.35)',
          color: '#00d4aa',
          padding: '10px 18px',
          borderRadius: 24,
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.06em',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,212,170,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 28px rgba(0,212,170,0.35)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,212,170,0.15)';
        }}
      >
        Guided Tour
      </button>
    );
  }

  const step = STEPS[activeStep];
  const progress = ((activeStep + 1) / STEPS.length) * 100;
  const isFirst = activeStep === 0;
  const isLast = activeStep === STEPS.length - 1;

  return (
    <>
      {/* Highlight ring */}
      <div
        style={{
          ...highlightStyle,
          borderRadius: 6,
          border: '2px solid #00d4aa',
          boxShadow: '0 0 0 4000px rgba(0,0,0,0.4), 0 0 18px rgba(0,212,170,0.4)',
          pointerEvents: 'none',
          transition: 'top 0.3s, left 0.3s, width 0.3s, height 0.3s',
        }}
      />

      {/* Tooltip card: fixed 380px wide, always on-screen */}
      <div
        style={{
          ...tooltipStyle,
          width: 380,
          boxSizing: 'border-box',
          background: 'rgba(8,14,20,0.97)',
          border: '1px solid rgba(0,212,170,0.28)',
          borderRadius: 14,
          boxShadow: '0 20px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,170,0.06)',
          fontFamily: "'IBM Plex Mono', monospace",
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          transition:
            'opacity 0.3s ease, top 0.35s cubic-bezier(.4,0,.2,1), left 0.35s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #00d4aa, #00b8ff)',
              transition: 'width 0.5s ease',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px 0' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: '#00d4aa',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {activeStep + 1} / {STEPS.length}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Step dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveStep(i)}
                    role="button"
                    aria-label={`Go to step ${i + 1}`}
                    style={{
                      width: i === activeStep ? 14 : 5,
                      height: 5,
                      borderRadius: 3,
                      background:
                        i === activeStep ? '#00d4aa' : 'rgba(136,153,170,0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                    }}
                  />
                ))}
              </div>

              {/* Close */}
              <button
                onClick={finish}
                aria-label="Close tour"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#556677',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 2px',
                  lineHeight: 1,
                  fontFamily: 'inherit',
                }}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#e8ecf1',
              marginBottom: 10,
              lineHeight: 1.3,
            }}
          >
            {step.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: '12px',
              color: '#8899aa',
              lineHeight: 1.65,
              marginBottom: 14,
            }}
          >
            {step.description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px 14px',
            borderTop: '1px solid rgba(136,153,170,0.08)',
          }}
        >
          <button
            onClick={finish}
            style={{
              background: 'none',
              border: 'none',
              color: '#445566',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
              padding: '6px 0',
            }}
          >
            Skip tour
          </button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Auto-play toggle */}
            <button
              onClick={() => setAutoPlay((p) => !p)}
              style={{
                background: autoPlay ? 'rgba(0,212,170,0.1)' : 'none',
                border:
                  '1px solid ' +
                  (autoPlay ? 'rgba(0,212,170,0.3)' : 'rgba(136,153,170,0.18)'),
                color: autoPlay ? '#00d4aa' : '#556677',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '5px 10px',
                borderRadius: 6,
                transition: 'all 0.15s',
              }}
            >
              {autoPlay ? 'Pause' : 'Auto'}
            </button>

            {!isFirst && (
              <button
                onClick={goBack}
                style={{
                  background: 'none',
                  border: '1px solid rgba(136,153,170,0.2)',
                  color: '#c8d0d8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '6px 14px',
                  borderRadius: 6,
                  letterSpacing: '0.04em',
                  transition: 'border-color 0.15s',
                }}
              >
                Back
              </button>
            )}

            <button
              onClick={goNext}
              style={{
                background: '#00d4aa',
                border: '1px solid #00d4aa',
                color: '#050a0f',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '6px 18px',
                borderRadius: 6,
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 14px rgba(0,212,170,0.45)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
