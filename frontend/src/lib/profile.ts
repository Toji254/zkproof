export type UserRole = 'renter' | 'landlord';
export type AttestationType = 'income' | 'balance' | 'credit';

export interface UserProfile {
  role: UserRole;
  publicId: string;
  createdAt: string;
  walletAddress?: string;
  lastTxHash?: string;
  lastAttestationType?: AttestationType;
}

export interface LandlordLedgerRecord {
  id: string;
  landlordPublicId: string;
  renterPublicId: string;
  renterWalletAddress: string;
  attestationType: string;
  threshold: string;
  issuedAt: string;
  expiresAt: string;
  proofHash: string;
  txHash?: string;
  contractId?: string;
  network: 'testnet' | 'public';
  savedAt: string;
}

const PROFILE_STORAGE_KEY = 'proofpass_profiles_v1';
const LEDGER_STORAGE_KEY = 'proofpass_landlord_ledger_v1';
export const LEDGER_CHANGED_EVENT = 'proofpass:ledger-changed';
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readProfiles(): Partial<Record<UserRole, UserProfile>> {
  if (!hasStorage()) return {};

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<UserRole, UserProfile>>) : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles: Partial<Record<UserRole, UserProfile>>): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function generatePublicId(role: UserRole, existingIds: Set<string>): string {
  const prefix = role === 'renter' ? 'RNT' : 'LND';

  while (true) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    }

    const candidate = `${prefix}-${code}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
}

export function getProfile(role: UserRole): UserProfile | null {
  return readProfiles()[role] ?? null;
}

export function ensureProfile(role: UserRole): UserProfile {
  const profiles = readProfiles();
  const existing = profiles[role];
  if (existing) return existing;

  const existingIds = new Set(Object.values(profiles).map((profile) => profile?.publicId).filter(Boolean) as string[]);
  const created: UserProfile = {
    role,
    publicId: generatePublicId(role, existingIds),
    createdAt: new Date().toISOString(),
  };

  profiles[role] = created;
  writeProfiles(profiles);
  return created;
}

export function updateProfile(role: UserRole, patch: Partial<UserProfile>): UserProfile {
  const current = ensureProfile(role);
  const updated: UserProfile = { ...current, ...patch, role: current.role, publicId: current.publicId, createdAt: current.createdAt };
  const profiles = readProfiles();
  profiles[role] = updated;
  writeProfiles(profiles);
  return updated;
}

export function getAllProfiles(): Partial<Record<UserRole, UserProfile>> {
  return readProfiles();
}

export function getLedgerRecords(): LandlordLedgerRecord[] {
  if (!hasStorage()) return [];

  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LandlordLedgerRecord[]) : [];
    return parsed.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export function saveLedgerRecord(record: Omit<LandlordLedgerRecord, 'id' | 'savedAt'>): LandlordLedgerRecord {
  const existing = getLedgerRecords();
  const duplicateIndex = existing.findIndex((entry) =>
    entry.landlordPublicId === record.landlordPublicId &&
    entry.renterPublicId === record.renterPublicId &&
    entry.attestationType === record.attestationType &&
    entry.proofHash === record.proofHash,
  );

  if (duplicateIndex >= 0) {
    const duplicate = existing[duplicateIndex];
    const updated: LandlordLedgerRecord = {
      ...duplicate,
      ...record,
      id: duplicate.id,
      savedAt: new Date().toISOString(),
    };
    const next = [...existing];
    next.splice(duplicateIndex, 1);

    if (hasStorage()) {
      window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify([updated, ...next]));
      window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
    }

    return updated;
  }

  const saved: LandlordLedgerRecord = {
    ...record,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };

  if (hasStorage()) {
    window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify([saved, ...existing]));
    window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
  }

  return saved;
}

export function clearLedgerRecords(landlordPublicId?: string): void {
  if (!hasStorage()) return;

  if (!landlordPublicId) {
    window.localStorage.removeItem(LEDGER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
    return;
  }

  const next = getLedgerRecords().filter((entry) => entry.landlordPublicId !== landlordPublicId);
  window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
}
