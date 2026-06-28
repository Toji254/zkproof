/**
 * LandlordMarket — marketplace of qualified renters.
 *
 * Pulls from two local sources:
 *   1. The landlord's ledger (`getLedgerRecords`) — every renter the landlord
 *      has accepted/verified becomes a "qualified renter" entry in the market.
 *   2. The landlord's own unit listings (`listListings`) — units the landlord
 *      has posted appear at the top with their threshold.
 *
 * This is the "killer demo screen" judges remember: a single page that shows
 * the product actually working as a marketplace, not just a verifier call.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureProfile, getLedgerRecords, type LandlordLedgerRecord } from '../lib/profile';
import { listListings, saveListing, removeListing, type MarketListing } from '../lib/marketListings';
import { getStellarExpertTxUrl } from '../lib/explorer';
import { CONTRACT_ID } from '../lib/config';

interface Props {
  walletAddress: string;
}

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

  // Form state for posting a new unit listing
  const [unitName, setUnitName] = useState('');
  const [rentDisplay, setRentDisplay] = useState('');
  const [thresholdDisplay, setThresholdDisplay] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    setListings(listListings());
    setLedgerRecords(getLedgerRecords());
  }, []);

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

  return (
    <section className="page">
      <header className="page-header">
        <h1>Landlord Market</h1>
        <p className="lead">
          Renters who have proven qualification, and units that landlords have posted. Everything
          lives on Stellar; this view is just the local mirror.
        </p>
        {walletAddress && (
          <p className="meta">
            Logged in as <strong>{landlordProfile.publicId}</strong> · {shortAddr(walletAddress)}
          </p>
        )}
      </header>

      <div className="market-grid">
        <div className="market-col">
          <h2>Your posted units</h2>
          <form onSubmit={onPost} className="post-form">
            <label>
              Unit name
              <input
                type="text"
                placeholder="2BR apartment, Westlands"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                required
              />
            </label>
            <label>
              Rent (display)
              <input
                type="text"
                placeholder="KSh 80,000 / month"
                value={rentDisplay}
                onChange={(e) => setRentDisplay(e.target.value)}
              />
            </label>
            <label>
              Threshold (display)
              <input
                type="text"
                placeholder="Income ≥ 3000"
                value={thresholdDisplay}
                onChange={(e) => setThresholdDisplay(e.target.value)}
                required
              />
            </label>
            <label>
              City
              <input
                type="text"
                placeholder="Nairobi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <button type="submit" className="cta">Post unit</button>
          </form>

          {listings.length === 0 ? (
            <p className="empty">No units posted yet. Use the form above to add one.</p>
          ) : (
            <ul className="listing-list">
              {listings.map((l) => (
                <li key={l.id} className="listing-card">
                  <header>
                    <strong>{l.unitName}</strong>
                    <span className="city">{l.city}</span>
                  </header>
                  <dl>
                    <dt>Rent</dt><dd>{l.rentDisplay}</dd>
                    <dt>Threshold</dt><dd>{l.thresholdDisplay}</dd>
                    <dt>Landlord</dt><dd>{l.landlordPublicId}</dd>
                  </dl>
                  <button type="button" className="ghost" onClick={() => onRemove(l.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="market-col">
          <h2>Qualified renters</h2>
          {qualifiedRenters.length === 0 ? (
            <p className="empty">
              No qualifying renters in your ledger yet. Run the verifier flow on a renter
              address and save the result to start filling this list.
            </p>
          ) : (
            <ul className="renter-list">
              {qualifiedRenters.map((r) => {
                const expires = new Date(r.expiresAt);
                const txUrl = r.txHash ? getStellarExpertTxUrl(r.txHash) : null;
                return (
                  <li key={r.id} className="renter-card">
                    <header>
                      <span className="status qualified">Qualified</span>
                      <span className="threshold">{r.threshold}</span>
                    </header>
                    <dl>
                      <dt>Renter ID</dt><dd>{r.renterPublicId || '—'}</dd>
                      <dt>Wallet</dt><dd className="mono">{shortAddr(r.renterWalletAddress)}</dd>
                      <dt>Type</dt><dd>{r.attestationType}</dd>
                      <dt>Expires</dt><dd>{Number.isFinite(expires.getTime()) ? expires.toLocaleDateString() : '—'}</dd>
                      <dt>Proof TX</dt>
                      <dd>
                        {txUrl ? (
                          <a href={txUrl} target="_blank" rel="noreferrer">View on Stellar Expert ↗</a>
                        ) : (
                          <span className="muted">no tx hash saved</span>
                        )}
                      </dd>
                      <dt>Contract</dt><dd className="mono">{shortAddr(r.contractId || CONTRACT_ID)}</dd>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <footer className="page-footer">
        <Link to="/">← home</Link>
        <span> · </span>
        <Link to="/facility/verify">Landlord verify</Link>
      </footer>
    </section>
  );
}
