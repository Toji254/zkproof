import { useEffect, useState } from "react";
import {
  isAllowed as isFreighterAllowed,
  isConnected as isFreighterConnected,
  requestAccess as requestFreighterAccess,
  signTransaction as signFreighterTransaction,
} from "@stellar/freighter-api";
import { StellarWalletsKit, ensureKit } from "./kit";

function getKit(): typeof StellarWalletsKit {
  ensureKit();
  return StellarWalletsKit;
}

function extractFreighterAddress(result: unknown): string | null {
  if (typeof result === "string") {
    return result;
  }

  const maybeAddress = (result as { address?: unknown } | null)?.address;
  return typeof maybeAddress === "string" ? maybeAddress : null;
}

export interface WalletOption {
  id: string;
  name: string;
  icon?: string;
  productName: string;
  url?: string;
  installed: boolean;
  canConnect: boolean;
  available: boolean;
  statusText: string;
}

const WALLET_LABELS: Record<string, string> = {
  albedo: "Albedo",
  freighter: "Freighter",
  hana: "Hana Wallet",
  hotwallet: "Hot Wallet",
  klever: "Klever Wallet",
  ledger: "Ledger",
  lobstr: "Lobstr",
  onekey: "OneKey",
  rabet: "Rabet",
  trezor: "Trezor",
  wc: "WalletConnect",
  xbull: "xBull",
  fordefi: "Fordefi",
  bitget: "Bitget",
  cactuslink: "Cactus Link",
};

const FALLBACK_ICON = "🔐";

const KNOWN_WALLET_ICONS: Record<string, string> = {
  freighter: '/wallet-icons/freighter.png',
  xbull: '/wallet-icons/xbull.png',
  albedo: '/wallet-icons/albedo.png',
  lobstr: '/wallet-icons/lobstr.png',
  hana: '/wallet-icons/hana.png',
  rabet: '/wallet-icons/rabet.png',
  ledger: '/wallet-icons/ledger.png',
  trezor: '/wallet-icons/trezor.png',
  wc: '/wallet-icons/walletconnect.png',
  klever: '/wallet-icons/klever.png',
  bitget: '/wallet-icons/bitget.png',
  fordefi: '/wallet-icons/fordefi.png',
  cactuslink: '/wallet-icons/cactuslink.png',
};

const WALLET_ACCENTS: Record<string, string> = {
  freighter: "#00d4aa",
  xbull: "#ff8a00",
  albedo: "#7c3aed",
  lobstr: "#f97316",
  hana: "#ec4899",
  rabet: "#22c55e",
  ledger: "#d1d5db",
  trezor: "#f59e0b",
  wc: "#3b82f6",
  onekey: "#8b5cf6",
  klever: "#06b6d4",
  bitget: "#f97316",
  fordefi: "#10b981",
  cactuslink: "#14b8a6",
  hotwallet: "#64748b",
};

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function walletInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (letters || "W").toUpperCase();
}

export function getWalletIconFallback(id: string, name: string): string {
  const accent = WALLET_ACCENTS[id] ?? "#00d4aa";
  const initials = escapeSvgText(walletInitials(name));
  const label = escapeSvgText(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#08111a" />
          <stop offset="100%" stop-color="#0f1b28" />
        </linearGradient>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.12" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="url(#bg)" stroke="url(#ring)" stroke-width="3" />
      <circle cx="32" cy="25" r="14" fill="${accent}" fill-opacity="0.18" />
      <text x="32" y="37" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="18" font-weight="700" fill="#e8ecf1">${initials}</text>
      <path d="M19 46h26" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const WALLET_ORDER = [
  "freighter",
  "xbull",
  "albedo",
  "lobstr",
  "hana",
  "rabet",
  "ledger",
  "trezor",
  "wc",
  "onekey",
  "klever",
  "bitget",
  "fordefi",
  "cactuslink",
  "hotwallet",
] as const;

type SupportedWallet = {
 id: string;
 name: string;
 icon?: string;
 isAvailable: boolean;
 url?: string;
};

function sortWallets(wallets: WalletOption[]): WalletOption[] {
 const rank = new Map<string, number>(WALLET_ORDER.map((id, index) => [id, index]));

 return [...wallets].sort((a, b) => {
   if (a.installed !== b.installed) return a.installed ? -1 : 1;
   if (a.canConnect !== b.canConnect) return a.canConnect ? -1 : 1;

   const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
   const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;

   if (aRank !== bRank) return aRank - bRank;
   return a.name.localeCompare(b.name);
 });
}

async function detectFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const stellarProvider = (window as any).stellar;
  if (
    typeof (window as any).freighterApi !== "undefined" ||
    stellarProvider?.provider === "freighter" ||
    typeof stellarProvider?.requestAccess === "function" ||
    typeof stellarProvider?.isConnected === "function"
  ) {
    return true;
  }

  try {
    const [connected, allowed] = await Promise.all([
      isFreighterConnected().catch(() => false),
      isFreighterAllowed().catch(() => false),
    ]);

    return Boolean(connected || allowed);
  } catch {
    return false;
  }
}

async function normalizeWallet(wallet: SupportedWallet): Promise<WalletOption> {
  const isFreighter = wallet.id === "freighter";
  const freighterInstalled = isFreighter ? await detectFreighterInstalled() : false;
  const installed = wallet.isAvailable || freighterInstalled;
  const canConnect = wallet.isAvailable || (isFreighter && freighterInstalled);

  let statusText = wallet.isAvailable
    ? "Installed — ready to connect"
    : "Not installed — open download page";

  if (isFreighter && freighterInstalled && !wallet.isAvailable) {
    statusText = "Installed — approve access to connect";
  }

  return {
    id: wallet.id,
    name: WALLET_LABELS[wallet.id] ?? wallet.name,
    productName: wallet.name,
    icon: KNOWN_WALLET_ICONS[wallet.id] ?? wallet.icon ?? FALLBACK_ICON,
    url: wallet.url,
    installed,
    canConnect,
    available: wallet.isAvailable,
    statusText,
  };
}

/**
 * List every wallet module the kit knows about, with availability checked
 * via each module's `isAvailable()` async method.
 */
export async function listAvailableWallets(): Promise<WalletOption[]> {
  let wallets: SupportedWallet[] = [];

  try {
    const kit = getKit();
    wallets = (await kit.refreshSupportedWallets()) as SupportedWallet[];
  } catch {
    wallets = [];
  }

  const normalized = await Promise.all(wallets.map((wallet) => normalizeWallet(wallet)));
  return sortWallets(normalized.filter((wallet) => wallet.installed));
}

/**
 * Connect to a chosen wallet module. Returns the G... address.
 *
 * The kit's static `getAddress()` requires that the desired module is
 * already the active one (set via `setWallet(id)`). Then it returns
 * `{ address }` on success or throws.
 */
export async function connectWithWallet(moduleId: string): Promise<string> {
  const kit = getKit();
  StellarWalletsKit.setWallet(moduleId);
  localStorage.setItem('zkproof_connected_wallet_id', moduleId);

  if (moduleId === "freighter") {
    // Freighter's direct API grants site access without going through the
    // wallet-kit module's stricter `isConnected()` guard.
    try {
      const addr = extractFreighterAddress(await requestFreighterAccess());
      if (addr && addr.length > 10) return addr;
    } catch {
      // fall through to kit path
    }
  }

  // kit.fetchAddress() works for all wallet types and handles the popup
  try {
    const { address } = await kit.fetchAddress();
    if (address) return address;
  } catch (e: any) {
    throw new Error(e?.message ?? "Wallet connection failed.");
  }

  throw new Error("Wallet connection returned no address.");
}

/**
 * Sign a transaction with the kit. The user must have already connected.
 */
export async function signWithKit(
  xdr: string,
  address: string,
  networkPassphrase: string,
): Promise<string> {
  const walletId = localStorage.getItem('zkproof_connected_wallet_id');

  if (walletId === "freighter") {
    try {
      await requestFreighterAccess();
    } catch {
      // Freighter may already be approved; proceed to signing.
    }

    const signedTxXdr = await signFreighterTransaction(xdr, {
      networkPassphrase,
      accountToSign: address,
    });

    if (!signedTxXdr) {
      throw new Error(
        "Wallet signing was cancelled or failed.",
      );
    }

    return signedTxXdr;
  }

  if (walletId) {
    StellarWalletsKit.setWallet(walletId);
  }
  const result: any = await getKit().signTransaction(xdr, {
    networkPassphrase,
    address,
  });
  if (result.error || !result.signedTxXdr) {
    throw new Error(
      result.error?.message ?? "Wallet signing was cancelled or failed.",
    );
  }
  return result.signedTxXdr;
}

/**
 * React hook: returns the list of available wallets, with re-check on focus
 * so the UI updates if the user installs/uninstalls a wallet extension.
 */
export function useAvailableWallets(): { wallets: WalletOption[]; loading: boolean } {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await listAvailableWallets();
        if (!cancelled) setWallets(list);
      } catch {
        if (!cancelled) setWallets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return { wallets, loading };
}
