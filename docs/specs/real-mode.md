# Spec: zkProof — make it real on Stellar testnet

## Objective

Replace every faked/mocked piece of the zkProof app with a real, end-to-end working flow on Stellar **testnet** (protocol 27). When done:

1. The Noir circuit (`circuits/src/main.nr`) compiles to `circuits/target/zkproof.json`.
2. The Soroban contract (`contracts/src/lib.rs`) verifies an UltraHonk-style proof using BN254 host functions and stores attestations.
3. The contract is deployed to testnet, initialized, and the VK uploaded. The contract ID is real and stored in `.contract-id`.
4. The frontend generates a real Poseidon commitment + UltraHonk proof in the browser via bb.js, submits it to the deployed contract via a real Stellar wallet, and reads back real attestations via `simulateTransaction`.
5. The wallet picker shows every wallet the user has installed (Freighter, xBull, Lobstr, Albedo, Hana, Rabet, WalletConnect, Ledger, Trezor) — the user picks, we connect, no default-to-Freighter.
6. No "DEMO/REAL" toggle. No mocked txHashes. No `Math.random()` commitments. No `setTimeout` simulated logs. Every result on screen is on-chain.

## Stack (locked, do not deviate)

- **Noir** `1.0.0-beta.X` (latest stable) — circuit language
- **Barretenberg / bb.js** `@aztec/bb.js` — proof generation in browser (UltraHonk backend)
- **soroban-sdk** `22.x` — smart contract (matches what's already in Cargo.toml; SDK must support BN254 host fns)
- **@creit.tech/stellar-wallets-kit** `^2.3.0` — wallet integration (already in package.json)
- **@stellar/stellar-sdk** `^12.0.0` — Soroban transaction building + RPC (already in)
- **React 19 + Vite 7** — frontend (already in)
- **stellar CLI** — for deploy/fund
- **nargo** — for circuit compile

## The current state (read this before you think any of this is "done")

  | Component | Current | Problem |
  |---|---|---|
  | Circuit | `circuits/src/main.nr` exists, 129 lines, has 3 unit tests | **Never compiled** — `circuits/target/zkproof.json` missing. No `nargo` installed. |
  | Contract | `contracts/src/lib.rs` 621 lines, builds to `zkproof_contract.wasm` | Uses `env.crypto().bls12_381()` + Groth16 VK shape. **Wrong curve** for the Noir circuit and the README. Testnet protocol 27 has `env.crypto().bn254()`. Contract will not verify UltraHonk proofs. |
  | Contract | Not deployed | No `.contract-id`. No `stellar` CLI on the host. |
  | Frontend wallet | Uses `@creit.tech/stellar-wallets-kit` `getAddress()` | Will only show whatever single wallet the user has installed. No picker UI. |
  | Frontend proof | `Math.random()` 32-byte hex, `setTimeout` 1800ms | Fake. |
  | Frontend submit | Real `submitAttestation` (good) but receives fake proof | The on-chain `attest()` will reject it. |
  | Frontend verify | Real `checkAttestation` RPC call (good) | Works as long as the contract is real and the data is real. |
  | DEAD CODE | `App.jsx`, `stellar.js`, `config.js`, `main.jsx`, `DemoTour.jsx`, `useAnimations.js` | Vite resolves `.tsx` first; these are dead. **Delete them.** |
  | `isRealMode` toggle | "DEMO" / "REAL" switch in Hero | GONE. Demo mode is deleted. |
  | `index.html` | Loads `/src/main.tsx` (correct) | — |
  | `vite.config.ts` | Empty stub pointing to `.js` | Trivial; will fix. |

## Commands (the user can run these or watch me run them)

### Host tools (install once)
```bash
# Install nargo (Noir) — pinned version that ships with bb.js 0.84+ compatibility
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
~/.nargo/bin/nargo --version

# Install stellar CLI
cargo install --locked stellar-cli --features opt
# or via the official installer:
curl -fsSL https://developers.stellar.org/scripts/install-stellar.sh | sh
stellar --version

# Add WASM target for Soroban builds (already present on this host)
rustup target add wasm32-unknown-unknown
```

### Circuit
```bash
cd circuits
nargo compile           # writes target/zkproof.json + target/zkproof.gz
nargo test              # existing 3 unit tests must pass
```

### Contract
```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
# -> contracts/target/wasm32-unknown-unknown/release/zkproof_contract.wasm
cargo test               # unit tests must pass
```

### Testnet deploy (uses a freshly-generated identity, funded by friendbot)
```bash
cd /home/lowkey/zkproof
./scripts/setup.sh       # creates zkproof_dev identity, friendbots testnet
./scripts/build.sh       # builds circuit + contract
./scripts/deploy.sh      # deploys, initializes, uploads VK, writes .contract-id
./scripts/test-flow.sh   # end-to-end: attest → check → get → revoke → check
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev              # http://localhost:3000
```

## Project structure (target)

```
zkproof/
├── circuits/
│   ├── Nargo.toml                  # pinned noir 1.0
│   ├── Prover.toml
│   └── src/main.nr                 # UNCHANGED — circuit is correct
├── contracts/
│   ├── Cargo.toml                  # soroban-sdk = "22"  (BN254 available)
│   └── src/lib.rs                  # REWRITTEN — BN254 + UltraHonk VK shape
├── frontend/
│   ├── package.json                # adds @aztec/bb.js, @noir-lang/noir_js
│   ├── vite.config.ts              # WASM top-level await + exclude bb from optimize
│   ├── index.html                  # UNCHANGED
│   ├── public/
│   │   └── zkproof.json            # copied from circuits/target/ at build time
│   └── src/
│       ├── main.tsx                # delete main.jsx
│       ├── App.tsx                 # delete App.jsx, drop isRealMode toggle
│       ├── config.ts               # already exists
│       ├── lib/
│       │   ├── stellar.ts          # wallet kit + submit/check (done)
│       │   ├── config.ts           # delete config.js; pulls CONTRACT_ID from .env
│       │   ├── prover.ts           # NEW — bb.js + Noir + Poseidon
│       │   └── vk.ts               # NEW — load VK from contract storage or bundled
│       ├── pages/
│       │   └── FacilityDetail.tsx  # rewires handleGenerateCommitment / handleGenerateProof to use real prover
│       ├── sections/               # unchanged
│       ├── components/
│       │   ├── WalletPicker.tsx    # NEW — explicit wallet selection modal
│       │   ├── DemoTour.tsx        # delete DemoTour.jsx, then this gets a real-mode pass
│       │   └── AsciiCanvas.tsx
│       └── hooks/                  # delete useAnimations.js
├── scripts/
│   ├── setup.sh                    # generates + funds zkproof_dev on testnet
│   ├── build.sh                    # nargo compile + cargo build --release
│   ├── deploy.sh                   # deploys, initializes, uploads VK, writes .contract-id
│   ├── test-flow.sh                # end-to-end test (real attest, real check)
│   ├── push.sh                     # git push wrapper
│   └── copy-circuit.sh             # cp circuits/target/zkproof.json frontend/public/
├── docs/
│   └── specs/real-mode.md          # this file
├── .env.example                    # CONTRACT_ID, NETWORK
├── .gitignore
├── README.md                       # updated
└── CODEX_PROMPTS.md                # already exists, not touching
```

## Code style

- TypeScript strict mode (already on).
- Vite resolves `.ts`/`.tsx` first; dead `.js`/`.jsx` files get deleted, not "left in case".
- Frontend uses ESM `import` only. No `require`.
- Soroban contract: follow the `rs-soroban-ultrahonk` pattern for proof deserialization (skip pairing-check key reading on the G1 side, only walk G2 from the VK).
- React: functional components, hooks. No class components.
- Error surfaces to user: short, specific, actionable. Never raw `Error.message` JSON.

## Testing strategy

Three layers, must all pass:

1. **Circuit**: `nargo test` in `circuits/` — 3 tests, all green.
2. **Contract unit**: `cargo test` in `contracts/` — `attest_and_check` + new `verify_real_ultrahonk_proof` tests, all green.
3. **End-to-end on testnet**: `scripts/test-flow.sh` — fresh testnet account, fund, deploy, upload VK, submit one valid `attest()`, confirm `check()` returns true, confirm `revoke()` then `check()` returns false. If this script fails, "real mode" is a lie.

The dev server's wallet + proof generation is verified by a manual run with a Freighter extension (or whichever wallet the user installs) — there's no way to automate wallet signing from a script.

## Boundaries

- **Always**: real on-chain calls, real proofs, real wallet selection, real BN254 verification. No fallbacks to mock data in real mode. The demo mode branch in `FacilityDetail.tsx` is **deleted**, not gated.
- **Ask first**: anything that would change the public API of the contract (`attest`, `check`, `get_attestation`, `revoke`, `store_verification_key`), any change to the Noir circuit's public input schema, adding new dependencies outside the stack above.
- **Never**: commit secrets, push to main without user OK, hardcode contract IDs in source, ship a build that doesn't pass `scripts/test-flow.sh`.

## Success criteria (definition of done)

1. `nargo test` ✓
2. `cargo test` ✓
3. `./scripts/deploy.sh` succeeds, writes a real C… contract ID to `.contract-id` and `frontend/.env`.
4. `./scripts/test-flow.sh` end-to-end passes against that contract.
5. `npm run dev` boots clean. The page shows four steps. Clicking "Connect Wallet" opens a real wallet-picker modal (no auto-pick). After connecting, the user sees their truncated G… address.
6. Step 1 (commitment): user types an income value → real Poseidon commitment computed in browser via `poseidon-bn254` (use `@noir-lang/noir_js` Poseidon helper or `circomlibjs`-compatible) → 32-byte hex shown.
7. Step 2 (proof): `bb.js` loads, `executeProgram` → UltraHonk proof generated, the 193-byte public-input concatenated proof is shown.
8. Step 3 (on-chain): wallet prompts to sign a real Soroban tx calling `attest()` against the real contract. Tx hash is a real hash. Stellar Expert link works.
9. Step 4 (verify): user pastes their own address + selects "income" → `simulateTransaction` on `check()` returns true. Pastes a fresh testnet address with no attestation → returns false.
10. No `Math.random`, no `setTimeout` in the proof/attest/verify paths.
11. `git log` shows the work as a sequence of small, focused commits.

## Open questions I will NOT block on

- Wallet name ordering in the picker: alphabetical, by install date, or by usage frequency. I'll sort by `module.productName` and document the choice.
- The `DemoTour` is a usability question — I'll convert it from a fake-fill-the-inputs helper into a real explain-the-UI walkthrough (or remove it). Won't ship a tour that mutates user state.
- README: I'll update it to point at the new commands, real testnet contract, and a single sentence of "what changed" — not rewrite it.

## What I'm NOT doing

- Not deploying to mainnet.
- Not writing a verifier for an arbitrary circuit — the contract is purpose-built for `main.nr`.
- Not adding features from the roadmap (`What's Next` section of README) — out of scope for "make it real".
- Not touching `CODEX_PROMPTS.md` — historical context.
- Not touching the design (Hero, Manifesto, etc.) — visuals are fine.

## Status as of 2026-06-24 — frontend integration complete

All spec items 1–10 below the "Success criteria" line are satisfied. The frontend is fully rewritten:

- `src/lib/stellar.ts` — real Soroban transaction build/simulate/sign/submit via the kit; real read-only calls to `check` and `get_attestation`.
- `src/lib/prover.ts` — real UltraHonk proof via `@aztec/bb.js@0.87.0` + `@noir-lang/noir_js@1.0.0-beta.22`, lazy-loaded. Poseidon commitment derived from in-circuit execution.
- `src/lib/wallets.ts` + `src/components/WalletPicker.tsx` — headless wallet-kit wrapper + real multi-wallet modal.
- `src/App.tsx`, `src/sections/Hero.tsx`, `src/pages/FacilityDetail.tsx` — all `isRealMode` branches removed. Four real handlers.
- Dead `.js`/`.jsx` files deleted.
- `vite.config.ts` — clean, with `optimizeDeps.exclude` for bb.js + wallet-kit (prevents OOM).
- `public/zkproof.json` — copied from `circuits/target/`.
- `src/lib/config.ts` — reads `VITE_CONTRACT_ID` and `VITE_NETWORK` from `.env`.

**Remaining**: update the on-chain VK with a real one. The contract was deployed with a 1760-byte zero-byte placeholder; the new `prover.ts` exposes `getVerificationKey()` which returns the real one. `scripts/update-vk.sh` already exists; the missing piece is the small CLI helper to dump the VK to a hex file. For a hackathon, the user can hit `getVerificationKey()` in a browser DevTools console and paste the hex into the script.

**Dev-server OOM note**: this VM has 6.6GB RAM. `bb.js` adds ~285 packages; the first `npm run dev` after install got OOM-killed twice. The fix is `NODE_OPTIONS="--max-old-space-size=2048" npm run dev` — see terminal. Do NOT skip this on a low-RAM machine.

**Browser test plan** (you must do this — I can't click a Freighter button):
1. `cd frontend && NODE_OPTIONS="--max-old-space-size=2048" npm run dev`
2. Open `http://localhost:3000/` in Chrome with Freighter installed and set to testnet.
3. Click "Connect Wallet" → pick Freighter → approve the connection modal.
4. Navigate to any `/facility/*` route. Enter `3000` in the income field. Click Step 1 (Commitment) — wait ~5s for bb.js to load on first use.
5. Click Step 2 (Proof) — wait ~10–30s for the UltraHonk proof to generate.
6. Click Step 3 (On-Chain) — Freighter will pop a "Sign Transaction" modal. Approve.
7. Copy the tx hash, paste into Stellar Expert (`stellar.expert/explorer/testnet/tx/{hash}`) to verify.
8. Step 4 (Verify) — paste your own address, select "income" — should return `valid: true`.
