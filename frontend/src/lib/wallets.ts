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

const FALLBACK_WALLETS: SupportedWallet[] = [
  {
    id: "freighter",
    name: "Freighter",
    icon: "https://stellar.creit.tech/wallet-icons/freighter.png",
    isAvailable: false,
    url: "https://www.freighter.app/",
  },
  {
    id: "xbull",
    name: "xBull",
    icon: "https://stellar.creit.tech/wallet-icons/xbull.png",
    isAvailable: false,
    url: "https://xbull.app/",
  },
  {
    id: "albedo",
    name: "Albedo",
    icon: "https://stellar.creit.tech/wallet-icons/albedo.png",
    isAvailable: false,
    url: "https://albedo.link/",
  },
  {
    id: "lobstr",
    name: "Lobstr",
    icon: "https://stellar.creit.tech/wallet-icons/lobstr.png",
    isAvailable: false,
    url: "https://lobstr.co/",
  },
  {
    id: "hana",
    name: "Hana Wallet",
    icon: "https://stellar.creit.tech/wallet-icons/hana.png",
    isAvailable: false,
    url: "https://hanawallet.io/",
  },
  {
    id: "rabet",
    name: "Rabet",
    icon: "https://stellar.creit.tech/wallet-icons/rabet.png",
    isAvailable: false,
    url: "https://rabet.io/",
  },
];

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
    icon: wallet.icon || FALLBACK_ICON,
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

  if (wallets.length === 0) {
    wallets = FALLBACK_WALLETS;
  }

  const normalized = await Promise.all(wallets.map((wallet) => normalizeWallet(wallet)));
  return sortWallets(normalized);
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
export function useAvailableWallets(): WalletOption[] {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await listAvailableWallets();
        if (!cancelled) setWallets(list);
      } catch {
        const fallback = await Promise.all(FALLBACK_WALLETS.map((wallet) => normalizeWallet(wallet)));
        if (!cancelled) setWallets(sortWallets(fallback));
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return wallets;
}
