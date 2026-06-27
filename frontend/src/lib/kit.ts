// Shared StellarWalletsKit singleton.
//
// Both wallets.ts (picker) and stellar.ts (transaction signing) need a
// kit instance. The kit's static init() must be called only once with the
// correct modules/network — a second call overwrites the first. This module
// owns the single init and re-exports what both callers need.
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";

let initDone = false;

export function ensureKit(): void {
  if (initDone) return;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: defaultModules(),
  });
  const walletId = typeof window !== 'undefined' ? localStorage.getItem('zkproof_connected_wallet_id') : null;
  if (walletId) {
    StellarWalletsKit.setWallet(walletId);
  }
  initDone = true;
}

export { StellarWalletsKit, Networks, defaultModules };
