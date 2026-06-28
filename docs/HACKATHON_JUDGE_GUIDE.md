# Judge Quickstart — ProofPass / Stellar Hacks: Real-World ZK

**Time:** 3 minutes. **Goal:** show that the ZK is doing real work, not
just decorating a UI.

---

## 60-second happy path

1. Open the live demo: https://zkproof.vercel.app
2. Click **I'm a renter**. Connect a wallet (Freighter works on testnet).
3. Income: `5000`. Threshold: `3000`. Click **Prove**.
4. Watch the proof generate locally in your browser (~30 s). The Noir
   circuit enforces `income > threshold` inside the WASM, not in the UI.
5. Soroban verifies the UltraHonk proof on Stellar testnet in one
   transaction. Click the tx link to inspect the proof on Stellar Expert.
6. Click **I'm a landlord**. Paste the renter's wallet address. You see
   only **YES**, the threshold proven, and the expiry date. No amounts,
   no documents, no transaction history.

## 60-second Qualified Renter demo (new for this hackathon)

1. Open https://zkproof.vercel.app/qualified
2. The page is pre-loaded with demo values (6 months of stable income,
   30 days of positive balances). The right-hand panel shows **Qualified**
   with the exact Poseidon commitment the circuit checks.
3. Edit one month to `200` (below the 70% floor). The badge flips to
   **Not qualified** with a clear reason: "Monthly income below stability
   floor".
4. Restore the value. Edit one balance to `10000000000000001` (just over
   the per-sample bound). The badge flips again: "Daily balance out of
   safe range".
5. Reset and watch the public inputs populate. Those exact bytes are
   what the on-chain verifier would check.

## 60-second Market demo (new for this hackathon)

1. Open https://zkproof.vercel.app/market
2. Post a unit: name = "2BR Westlands", rent = "KSh 80k / month",
   threshold = "Income >= 3000", city = "Nairobi".
3. If your wallet has run the verifier flow on any renter before, those
   renters appear under "Qualified renters" with on-chain proof links.
4. This is the screen that turns ProofPass from a verifier call into a
   marketplace: the landlord posts the requirement, the renters who have
   already proven qualification appear automatically.

## What's load-bearing about the ZK

- The Noir circuit (`circuits/src/main.nr`) enforces every rule. The
  browser cannot fake any of the three conditions.
- The Soroban verifier (`contracts/src/lib.rs`) runs the UltraHonk proof
  on-chain via `ultrahonk_soroban_verifier`. The full Oink + Sumcheck +
  Shplonk (BN254 pairing check) flow runs in WASM on the host.
- The keccak transcript is mandatory. The default UltraHonk mode passes
  locally but fails on-chain with `SumcheckFailed` (see memory note in
  the circuit).
- No financial number ever leaves the renter's device. The landlord view
  has no fetch path to the raw numbers — there is no API endpoint that
  returns them.

## What's new in this submission

| Move              | Where                                    | Why                                       |
|-------------------|------------------------------------------|-------------------------------------------|
| Multi-month income | `circuits/src/main.nr: main_multi`      | Catches "one paycheck" applicants         |
| No-negative-balance | `circuits/src/main.nr: main_clean`     | Catches overdrafts / liens                |
| Composite proof    | `circuits/src/main.nr: main_composite`  | All three rules in one proof              |
| Verifier type=4    | `contracts/src/lib.rs: attestation_type_to_u64` | Accepts "qualif" symbol           |
| Qualified page     | `frontend/src/pages/QualifiedRenter.tsx` | Live demo of composite witness            |
| Market page        | `frontend/src/pages/LandlordMarket.tsx` | Landlord marketplace screen               |

## Failure case (mandatory to demo)

- Income: `2500`, threshold: `3000`. Click Prove.
- Expected: proof generation aborts with "Income must exceed the minimum
  threshold". No attestation issued. The verifier view shows nothing.

## Live links

- Demo: https://zkproof.vercel.app
- Testnet contract: https://stellar.expert/explorer/testnet/contract/CDUXLEZQ6ZIQV3LN45VJOK5ONKRQOFFAIEK4JXPD63R2PDC5AF5VNJE3
- Source: https://github.com/Toji254/zkproof
- Demo video: see README.md "Demo video" link (record via Recordly per `tools/recordly/INSTALL.md`)

## Build & verify locally

```bash
# circuits
cd circuits && nargo test   # 15 tests pass

# contracts (Rust + ultrahonk_soroban_verifier from NethermindEth)
cd ../contracts && cargo test --lib   # 4 tests pass
cargo test --test vk_probe             # 1 VK layout test passes

# frontend
cd ../frontend && npm install && NODE_OPTIONS="--max-old-space-size=2048" npm run dev
```

## Why this is not just another proof-of-funds demo

Most competing privacy projects at this hackathon live in one of two lanes:

1. **Crypto-native payment/privacy infrastructure** (privacy pools,
   shielded transfers, confidential tokens). These are infrastructure —
   they need a developer to integrate them into a product.
2. **Institutional compliance / solvency tools.** These target
   institutions, not consumers, and they rarely have a user-facing
   screen.

ProofPass is the **consumer-facing rental qualification product** that
sits on top of the same ZK primitives those projects expose. The renter
experiences a two-minute flow; the landlord experiences a yes/no
attestation. The ZK is doing the work — the user does not see it.

That positioning is the wedge.
