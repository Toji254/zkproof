/**
 * LandlordMarket — marketplace of qualified renters + landlord unit postings.
 *
 * Pulls from two local sources:
 *   1. The landlord's ledger (`getLedgerRecords`) — every renter the landlord
 *      has accepted becomes a "qualified renter" entry.
 *   2. The landlord's own unit listings (`listListings`) — units posted with
 *      threshold + rent + city.
 *
 * Design system: matches the rest of the app (IBM Plex Mono + Geist Pixel
 * titles, #050a0f bg, #00d4aa accent, glass-card panels).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearLedgerRecords,
  ensureProfile,
  getLedgerRecords,
  LEDGER_CHANGED_EVENT,
  type LandlordLedgerRecord,
} from '../lib/profile';
import {
  clearListings,
  listListings,
  MARKET_LISTINGS_CHANGED_EVENT,
  removeListing,
  saveListing,
  type MarketListing,
} from '../lib/marketListings';
import { getStellarExpertTxUrl } from '../lib/explorer';
import { CONTRACT_ID } from '../lib/config';

interface Props {
  walletAddress: string;
}

const ACCENT = '#00d4aa';
const BG = '#050a0f';
const BG_CARD = 'rgba(13, 22, 32, 0.8)';
const BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT = '#e8ecf1';
const MUTED = '#8899aa';
const SUCCESS = '#00d4aa';
const FONT = "'IBM Plex Mono', 'Menlo', monospace";

function shortAddr(a: string): string {
  if (!a) return '—';
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function isExpired(record: LandlordLedgerRecord): boolean {
  const expires = Date.parse(record.expiresAt);
  return Number.isFinite(expires) && expires < Date.now();
}

export default function LandlordMarket({ walletAddress }: Props) {
  const landlordProfile = useMemo(() => ensureProfile('landlord'), []);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [ledgerRecords, setLedgerRecords] = useState<LandlordLedgerRecord[]>([]);

  const [unitName, setUnitName] = useState('');
  const [rentDisplay, setRentDisplay] = useState('');
  const [thresholdDisplay, setThresholdDisplay] = useState('');
  const [city, setCity] = useState('');

  const refreshMarketState = () => {
    setListings(listListings().filter((listing) => listing.landlordPublicId === landlordProfile.publicId));
    setLedgerRecords(getLedgerRecords().filter((record) => record.landlordPublicId === landlordProfile.publicId));
  };

  useEffect(() => {
    refreshMarketState();

    window.addEventListener('focus', refreshMarketState);
    window.addEventListener('storage', refreshMarketState);
    window.addEventListener(LEDGER_CHANGED_EVENT, refreshMarketState);
    window.addEventListener(MARKET_LISTINGS_CHANGED_EVENT, refreshMarketState);

    return () => {
      window.removeEventListener('focus', refreshMarketState);
      window.removeEventListener('storage', refreshMarketState);
      window.removeEventListener(LEDGER_CHANGED_EVENT, refreshMarketState);
      window.removeEventListener(MARKET_LISTINGS_CHANGED_EVENT, refreshMarketState);
    };
  }, [landlordProfile.publicId]);

  const qualifiedRenters = useMemo(() => {
    return ledgerRecords
      .filter((r) => !isExpired(r))
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  }, [ledgerRecords]);

  const onPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim() || !thresholdDisplay.trim()) return;
    const created = saveListing({
      landlordPublicId: landlordProfile.publicId,
      unitName: unitName.trim(),
      rentDisplay: rentDisplay.trim() || '—',
      thresholdDisplay: thresholdDisplay.trim(),
      city: city.trim() || '—',
    });
    setListings([created, ...listings]);
    setUnitName('');
    setRentDisplay('');
    setThresholdDisplay('');
    setCity('');
  };

  const onRemove = (id: string) => {
    removeListing(id);
    setListings(listings.filter((l) => l.id !== id));
  };

  const onClearQualifiedRenters = () => {
    if (!qualifiedRenters.length) return;
    const confirmed = window.confirm('Clear all qualified renters saved for this landlord?');
    if (!confirmed) return;
    clearLedgerRecords(landlordProfile.publicId);
    setLedgerRecords([]);
  };

  const onClearPostedUnits = () => {
    if (!listings.length) return;
    const confirmed = window.confirm('Clear all posted units for this landlord?');
    if (!confirmed) return;
    clearListings(landlordProfile.publicId);
    setListings([]);
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontFamily: FONT,
    fontSize: 13,
    color: TEXT,
    outline: 'none',
  };

  const labelBase: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 14,
  };

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: FONT,
        padding: '120px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.3em',
              color: ACCENT,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            ProofPass · Landlord
          </div>
          <h1
            style={{
              fontFamily: "'Geist Pixel', monospace",
              fontSize: 'clamp(28px, 4.5vw, 48px)',
              fontWeight: 400,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              letterSpacing: '0.01em',
              color: '#fff',
              margin: '0 0 16px',
              maxWidth: '22ch',
            }}
          >
            Landlord market
          </h1>
          <p
            style={{
              fontFamily: FONT,
              fontSize: 14,
              lineHeight: 1.7,
              color: MUTED,
              maxWidth: '64ch',
              margin: 0,
            }}
          >
            Post a unit. See every renter who has already proven qualification for
            your threshold. Inspect the underlying attestation on Stellar Expert —
            without ever seeing the renter's actual numbers.
          </p>
          {walletAddress && (
            <div
              style={{
                marginTop: 20,
                fontFamily: FONT,
                fontSize: 11,
                color: MUTED,
                letterSpacing: '0.06em',
              }}
            >
              Logged in as <span style={{ color: ACCENT }}>{landlordProfile.publicId}</span>
              <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span style={{ color: TEXT }}>{shortAddr(walletAddress)}</span>
            </div>
          )}
        </div>

        {/* Two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* LEFT: post unit + your listings */}
          <div
            id="market-post-card"
            style={{
              background: BG_CARD,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 28,
            }}
          >
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: ACCENT,
                margin: '0 0 20px',
              }}
            >
              Post a unit
            </h2>

            <form id="market-post-form" onSubmit={onPost}>
              <label style={labelBase}>
                Unit name
                <input
                  id="market-unit-name-input"
                  type="text"
                  placeholder="2BR apartment, Westlands"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  required
                  style={inputBase}
                />
              </label>
              <label style={labelBase}>
                Rent (display)
                <input
                  id="market-rent-input"
                  type="text"
                  placeholder="KSh 80,000 / month"
                  value={rentDisplay}
                  onChange={(e) => setRentDisplay(e.target.value)}
                  style={inputBase}
                />
              </label>
              <label style={labelBase}>
                Threshold (display)
                <input
                  id="market-threshold-input"
                  type="text"
                  placeholder="Income ≥ 3000"
                  value={thresholdDisplay}
                  onChange={(e) => setThresholdDisplay(e.target.value)}
                  required
                  style={inputBase}
                />
              </label>
              <label style={labelBase}>
                City
                <input
                  id="market-city-input"
                  type="text"
                  placeholder="Nairobi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={inputBase}
                />
              </label>

              <button
                id="market-post-submit"
                type="submit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  background: ACCENT,
                  color: BG,
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                Post unit
              </button>
            </form>

            {listings.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 14,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: MUTED,
                      margin: 0,
                    }}
                  >
                    Your posted units
                  </h3>
                  <button
                    type="button"
                    onClick={onClearPostedUnits}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: MUTED,
                      fontFamily: FONT,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {listings.map((l) => (
                    <article
                      key={l.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 10,
                        padding: '14px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONT,
                            fontSize: 14,
                            color: TEXT,
                            fontWeight: 600,
                          }}
                        >
                          {l.unitName}
                        </span>
                        <span
                          style={{
                            fontFamily: FONT,
                            fontSize: 11,
                            color: MUTED,
                            letterSpacing: '0.06em',
                          }}
                        >
                          {l.city}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 16,
                          fontFamily: FONT,
                          fontSize: 11,
                          color: MUTED,
                          marginBottom: 10,
                        }}
                      >
                        <span>
                          Rent · <span style={{ color: TEXT }}>{l.rentDisplay}</span>
                        </span>
                        <span>
                          Threshold · <span style={{ color: ACCENT }}>{l.thresholdDisplay}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(l.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: MUTED,
                          fontFamily: FONT,
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: qualified renters */}
          <div
            id="market-qualified-renters"
            style={{
              background: BG_CARD,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 28,
              minHeight: 320,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: ACCENT,
                  margin: 0,
                }}
              >
                Qualified renters
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    color: MUTED,
                    letterSpacing: '0.06em',
                  }}
                >
                  {qualifiedRenters.length} on file
                </span>
                {qualifiedRenters.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearQualifiedRenters}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: MUTED,
                      fontFamily: FONT,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {qualifiedRenters.length === 0 ? (
              <div
                style={{
                  padding: '32px 20px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px dashed ${BORDER}`,
                  textAlign: 'center',
                  fontFamily: FONT,
                  fontSize: 12,
                  color: MUTED,
                  lineHeight: 1.7,
                }}
              >
                No qualifying renters in your ledger yet.
                <br />
                Run the verifier flow on a renter address. Qualified checks are
                saved into this list automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {qualifiedRenters.map((r) => {
                  const expires = new Date(r.expiresAt);
                  const txUrl = r.txHash ? getStellarExpertTxUrl(r.txHash) : null;
                  return (
                    <article
                      key={r.id}
                      style={{
                        background: 'rgba(0,212,170,0.04)',
                        border: '1px solid rgba(0,212,170,0.18)',
                        borderRadius: 10,
                        padding: '16px 18px',
                      }}
                    >
                      <header
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 14,
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '5px 12px',
                            background: 'rgba(0,212,170,0.14)',
                            color: SUCCESS,
                            border: '1px solid rgba(0,212,170,0.30)',
                            borderRadius: 999,
                            fontFamily: FONT,
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          ✓ Qualified
                        </span>
                        <span
                          style={{
                            fontFamily: FONT,
                            fontSize: 14,
                            color: TEXT,
                            fontWeight: 600,
                          }}
                        >
                          {r.threshold}
                        </span>
                      </header>

                      <dl
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '110px 1fr',
                          rowGap: 8,
                          columnGap: 16,
                          margin: 0,
                          fontFamily: FONT,
                          fontSize: 12,
                        }}
                      >
                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Renter ID</dt>
                        <dd style={{ color: TEXT, margin: 0 }}>{r.renterPublicId || '—'}</dd>

                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Wallet</dt>
                        <dd style={{ color: ACCENT, margin: 0 }}>{shortAddr(r.renterWalletAddress)}</dd>

                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Type</dt>
                        <dd style={{ color: TEXT, margin: 0, textTransform: 'capitalize' }}>{r.attestationType}</dd>

                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Expires</dt>
                        <dd style={{ color: TEXT, margin: 0 }}>
                          {Number.isFinite(expires.getTime()) ? expires.toLocaleDateString() : '—'}
                        </dd>

                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Proof TX</dt>
                        <dd style={{ margin: 0 }}>
                          {txUrl ? (
                            <a
                              href={txUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: ACCENT,
                                textDecoration: 'none',
                                fontSize: 12,
                              }}
                            >
                              View on Stellar Expert ↗
                            </a>
                          ) : (
                            <span style={{ color: MUTED, fontSize: 11 }}>no tx hash saved</span>
                          )}
                        </dd>

                        <dt style={{ color: MUTED, letterSpacing: '0.06em' }}>Contract</dt>
                        <dd style={{ color: TEXT, margin: 0 }}>{shortAddr(r.contractId || CONTRACT_ID)}</dd>
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${BORDER}`,
            fontFamily: FONT,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <Link
            to="/"
            style={{
              color: ACCENT,
              textDecoration: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: 11,
            }}
          >
            ← home
          </Link>
          <span>·</span>
          <Link
            to="/facility/verify"
            style={{
              color: ACCENT,
              textDecoration: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: 11,
            }}
          >
            Landlord verify
          </Link>
        </div>
      </div>
    </section>
  );
}
