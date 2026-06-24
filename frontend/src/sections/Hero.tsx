import { Link } from 'react-router-dom';
import AsciiCanvas from '../components/AsciiCanvas';
import { heroConfig, navigationConfig } from '../config';

interface HeroProps {
  walletAddress: string;
  connect: () => void;
  disconnect: () => void;
}

export default function Hero({
  walletAddress,
  connect,
  disconnect,
}: HeroProps) {
  const notes = heroConfig.supportingNotes.slice(0, 3);
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        background: '#050a0f',
      }}
    >
      {/* Full-width sticky/fixed header */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 48px',
          background: 'rgba(5, 10, 15, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(136, 153, 170, 0.1)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#00d4aa',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {navigationConfig.brandName}
          </span>
          <nav style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {navigationConfig.links.map((item, index) => (
              <div key={`${item.label}-${item.href}`} style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                <a
                  href={item.href}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#8899aa',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    letterSpacing: '0.06em',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = '#e8ecf1';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = '#8899aa';
                  }}
                >
                  {item.label}
                </a>
                {index < navigationConfig.links.length - 1 && (
                  <span style={{ color: 'rgba(136, 153, 170, 0.15)', fontSize: '12px' }}>·</span>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Right side Actions: Wallet Connect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Connect Button */}
          {walletAddress ? (
            <button
              onClick={disconnect}
              id="connect-wallet-btn"
              style={{
                background: 'rgba(0, 212, 170, 0.08)',
                border: '1px solid rgba(0, 212, 170, 0.3)',
                color: '#e8ecf1',
                padding: '8px 18px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ff4466';
                e.currentTarget.style.color = '#ff4466';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.3)';
                e.currentTarget.style.color = '#e8ecf1';
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#00d4aa',
                }}
              />
              {truncatedAddress}
            </button>
          ) : (
            <button
              onClick={connect}
              id="connect-wallet-btn"
              style={{
                background: '#00d4aa',
                color: '#050a0f',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 212, 170, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              CONNECT WALLET
            </button>
          )}
        </div>
      </header>

      {/* Left Text / Info Column */}
      <div
        style={{
          position: 'relative',
          width: '42%',
          minWidth: '400px',
          background: '#050a0f',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 48px',
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(136, 153, 170, 0.1)',
        }}
      >
        <div style={{ marginTop: '80px' }}>
          <p
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: 1.6,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'rgba(0, 212, 170, 0.85)',
              margin: '0 0 16px 0',
            }}
          >
            {heroConfig.eyebrow}
          </p>
          <h1
            style={{
              fontFamily: "'Geist Pixel', monospace",
              fontSize: 'clamp(40px, 4.8vw, 76px)',
              fontWeight: 400,
              lineHeight: 0.94,
              color: '#e8ecf1',
              textTransform: 'uppercase',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            {heroConfig.titleLines.map((line, index) => (
              <span key={`${line}-${index}`}>
                {line}
                {index < heroConfig.titleLines.length - 1 && <br />}
              </span>
            ))}
          </h1>

          <p
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.85,
              color: '#8899aa',
              margin: '32px 0',
              maxWidth: '44ch',
            }}
          >
            {heroConfig.leadText}
          </p>

          {/* Interactive CTAs */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
            <Link
              to="/facility/enter-data"
              className="btn-zk btn-zk-primary"
              style={{ fontSize: '11px', padding: '12px 24px' }}
            >
              Start Proving
            </Link>
            <Link
              to="/facility/verify"
              id="verify-nav-btn"
              className="btn-zk btn-zk-outline"
              style={{ fontSize: '11px', padding: '12px 24px' }}
            >
              Verify Attestation
            </Link>
          </div>

          {/* Staggered Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {notes.map((note, index) => (
              <div 
                key={index} 
                style={{ 
                  display: 'flex', 
                  gap: '12px',
                  borderLeft: '1px solid rgba(0, 212, 170, 0.2)',
                  paddingLeft: '12px'
                }}
              >
                <span style={{ fontSize: '11px', color: '#00d4aa', fontWeight: 600 }}>0{index + 1}</span>
                <p
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 400,
                    lineHeight: 1.7,
                    color: 'rgba(136, 153, 170, 0.65)',
                    margin: 0,
                    maxWidth: '42ch',
                  }}
                >
                  {note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right ASCII Canvas Column */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          background: '#050a0f',
          overflow: 'hidden',
        }}
      >
        <AsciiCanvas />
      </div>
    </section>
  );
}
