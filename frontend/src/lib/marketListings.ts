/**
 * Market listings — landlord-posted rental units.
 *
 * Pure localStorage CRUD. Each listing binds:
 *   - landlord public ID (LND-XXXXXX)
 *   - human-readable unit name + rent + threshold
 *   - city / neighbourhood
 *   - creation timestamp
 *
 * The LandlordMarket page reads listings + landlord ledger records and shows
 * renters who have already proven qualification.
 */

export interface MarketListing {
  id: string;
  landlordPublicId: string;
  unitName: string;
  rentDisplay: string;
  thresholdDisplay: string;
  city: string;
  createdAt: number; // unix seconds
}

const STORAGE_KEY = 'proofpass_market_listings_v1';
const MAX_LISTINGS = 50;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAll(): MarketListing[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MarketListing[]) : [];
  } catch {
    return [];
  }
}

function writeAll(listings: MarketListing[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listings.slice(0, MAX_LISTINGS)));
}

export function listListings(): MarketListing[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveListing(listing: Omit<MarketListing, 'id' | 'createdAt'>): MarketListing {
  const created: MarketListing = {
    ...listing,
    id: 'MKT-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    createdAt: Math.floor(Date.now() / 1000),
  };
  const all = readAll();
  all.unshift(created);
  writeAll(all);
  return created;
}

export function removeListing(id: string): void {
  writeAll(readAll().filter((l) => l.id !== id));
}
