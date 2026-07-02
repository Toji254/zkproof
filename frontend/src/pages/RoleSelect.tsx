import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../config';
import { ensureProfile, getAllProfiles, type UserProfile } from '../lib/profile';

/**
 * RoleSelect — first thing every visitor sees.
 *
 * DeepSeek's exact ask: "when one opens the app he chooses if he is a
 * renter or a landlord first so that they can continue and the landlord
 * does not have to connect their wallet."
 *
 * Two big cards:
 *   - Renter → /prove  (wallet connect required, they sign the attest() tx)
 *   - Landlord → /facility/verify  (no wallet needed, just an address to query)
 *
 * The wallet picker is NOT triggered from this screen. The wallet only
 * opens when the renter actively proceeds, so landlords never see it.
 */
export default function RoleSelect() {
  const [profiles, setProfiles] = useState<Partial<Record<'renter' | 'landlord', UserProfile>>>({});

  useEffect(() => {
    setProfiles(getAllProfiles());
  }, []);

  const handleRoleContinue = (role: 'renter' | 'landlord') => {
    const profile = ensureProfile(role);
    setProfiles((prev) => ({ ...prev, [role]: profile }));
  };

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 32px 80px',
        background: '#050a0f',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#e8ecf1',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.3em',
          color: '#00d4aa',
          marginBottom: '24px',
          textTransform: 'uppercase',
        }}
      >
        ProofPass · Stellar Hacks
      </div>

      <h1
        style={{
          fontSize: 'clamp(28px, 4.5vw, 52px)',
          fontWeight: 700,
          lineHeight: 1.15,
          textAlign: 'center',
          maxWidth: '24ch',
          margin: '0 0 16px',
          color: '#ffffff',
        }}
      >
        Who are you proving to today?
      </h1>

      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.7,
          color: '#8899aa',
          textAlign: 'center',
          maxWidth: '56ch',
          margin: '0 0 64px',
        }}
      >
        ProofPass has two sides. Pick yours to see the right flow. You can
        switch any time from inside either flow.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 420px))',
          gap: '24px',
          width: '100%',
          maxWidth: '880px',
          justifyContent: 'center',
        }}
      >
        <Link
          to="/prove"
          onClick={() => handleRoleContinue('renter')}
          className="role-card"
          id="role-renter-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '40px 36px',
            border: '1px solid rgba(0, 212, 170, 0.25)',
            borderRadius: '6px',
            background:
              'linear-gradient(180deg, rgba(0, 212, 170, 0.04) 0%, rgba(5, 10, 15, 0.6) 100%)',
            textDecoration: 'none',
            color: '#e8ecf1',
            transition: 'all 0.2s',
            cursor: 'pointer',
            minHeight: '420px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#00d4aa';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 8px 32px rgba(0, 212, 170, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.25)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: '11px',
              letterSpacing: '0.25em',
              color: '#00d4aa',
              fontWeight: 600,
            }}
          >
            [ I'M A RENTER ]
          </div>

          <h2
            style={{
              fontSize: '26px',
              fontWeight: 700,
              margin: 0,
              color: '#ffffff',
              lineHeight: 1.25,
            }}
          >
            I need to prove I qualify
          </h2>

          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: '#8899aa',
              margin: 0,
              flex: 1,
            }}
          >
            Generate a zero-knowledge proof locally in your browser. Your
            salary, balance, or credit score never leaves your device. You
            sign one Stellar transaction to record the attestation, then
            share your renter ID plus wallet reference with the landlord.
          </p>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '12px',
              color: '#a8b8c8',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <li>→ Connect a Stellar testnet wallet</li>
            <li>→ Enter your private value (e.g. income 5000)</li>
            <li>→ Generate proof + submit attestation</li>
          </ul>

          {profiles.renter && (
            <div style={{ padding: '12px 14px', border: '1px solid rgba(0, 212, 170, 0.2)', background: 'rgba(0, 212, 170, 0.06)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8899aa', marginBottom: '6px' }}>
                Renter public ID
              </div>
              <div style={{ fontSize: '13px', color: '#00d4aa', fontWeight: 700, letterSpacing: '0.08em' }}>
                {profiles.renter.publicId}
              </div>
              <div style={{ fontSize: '10px', color: '#556677', marginTop: '6px', lineHeight: 1.6 }}>
                Share this as your ProofPass reference code when sending a proof to a landlord.
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '12px',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: '#00d4aa',
            }}
          >
            CONTINUE AS RENTER →
          </div>
        </Link>

        <Link
          to="/facility/verify"
          onClick={() => handleRoleContinue('landlord')}
          className="role-card"
          id="role-landlord-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '40px 36px',
            border: '1px solid rgba(136, 153, 170, 0.25)',
            borderRadius: '6px',
            background:
              'linear-gradient(180deg, rgba(136, 153, 170, 0.04) 0%, rgba(5, 10, 15, 0.6) 100%)',
            textDecoration: 'none',
            color: '#e8ecf1',
            transition: 'all 0.2s',
            cursor: 'pointer',
            minHeight: '420px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#8899aa';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 8px 32px rgba(136, 153, 170, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(136, 153, 170, 0.25)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: '11px',
              letterSpacing: '0.25em',
              color: '#8899aa',
              fontWeight: 600,
            }}
          >
            [ I'M A LANDLORD ]
          </div>

          <h2
            style={{
              fontSize: '26px',
              fontWeight: 700,
              margin: 0,
              color: '#ffffff',
              lineHeight: 1.25,
            }}
          >
            I need to verify a renter
          </h2>

          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: '#8899aa',
              margin: 0,
              flex: 1,
            }}
          >
            Paste the renter's Stellar wallet address, choose the
            requirement type, and click Check. Use your landlord ID as the
            handoff reference so the renter knows exactly who the proof is
            meant for. The contract returns a simple YES or NO with the
            proven threshold and expiry date. Nothing else.
          </p>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '12px',
              color: '#a8b8c8',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <li>→ No wallet needed</li>
            <li>→ Paste the renter's wallet address</li>
            <li>→ See qualified / not qualified + threshold + expiry</li>
          </ul>

          {profiles.landlord && (
            <div style={{ padding: '12px 14px', border: '1px solid rgba(136, 153, 170, 0.2)', background: 'rgba(136, 153, 170, 0.06)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8899aa', marginBottom: '6px' }}>
                Landlord public ID
              </div>
              <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, letterSpacing: '0.08em' }}>
                {profiles.landlord.publicId}
              </div>
              <div style={{ fontSize: '10px', color: '#556677', marginTop: '6px', lineHeight: 1.6 }}>
                Share this with the renter as the destination reference for their proof handoff.
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '12px',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: '#8899aa',
            }}
          >
            CONTINUE AS LANDLORD →
          </div>
        </Link>
      </div>

      <div
        style={{
          marginTop: '64px',
          fontSize: '11px',
          color: '#5a6a7a',
          letterSpacing: '0.1em',
          textAlign: 'center',
          maxWidth: '60ch',
        }}
      >
        Built on Stellar testnet · Zero-knowledge by Noir + Barretenberg ·
        Verified on-chain via Soroban BN254 host functions ·{' '}
        <Link
          to="/"
          style={{ color: '#8899aa', textDecoration: 'underline' }}
        >
          back to overview
        </Link>
      </div>

      <title>{siteConfig.siteTitle} — Choose your role</title>
    </section>
  );
}
