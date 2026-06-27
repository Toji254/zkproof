// Stellar / Soroban Network Configuration
//
// Reads from Vite env vars written by scripts/deploy.sh to frontend/.env:
//   VITE_CONTRACT_ID
//   VITE_NETWORK
//
// Defaults to the live testnet deployment so the dev server "just works"
// after running ./scripts/deploy.sh.

const env = (import.meta as any).env ?? {};

const rawNetwork = String(env.VITE_NETWORK ?? "TESTNET").trim().toUpperCase();

export const CONTRACT_ID: string = env.VITE_CONTRACT_ID ?? "";
export const NETWORK: "TESTNET" | "PUBLIC" =
  rawNetwork === "PUBLIC" ? "PUBLIC" : "TESTNET";

export const NETWORK_PASSPHRASE =
  NETWORK === "TESTNET"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

// In development the Vite dev server proxies these paths to the real hosts
// (see vite.config.ts server.proxy). This avoids COEP 'require-corp' blocking
// direct cross-origin fetches to third-party RPC/Horizon endpoints.
// We use the fully-qualified origin so the Stellar SDK can parse the URL.
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const devOrigin =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const RPC_URL = isDev
  ? `${devOrigin}/soroban-rpc`
  : NETWORK === "TESTNET"
    ? "https://soroban-testnet.stellar.org"
    : "https://soroban-mainnet.stellar.org";

export const HORIZON_URL = isDev
  ? `${devOrigin}/horizon-api`
  : NETWORK === "TESTNET"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
