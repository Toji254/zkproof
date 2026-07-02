# Judge Quickstart

## Open this first

1. Open `/start` on the live demo — you'll see two cards (Renter vs Landlord). Pick the one you want to inspect.
   - **Renter** → `/prove` (you'll be asked to connect a Stellar testnet wallet)
   - **Landlord** → `/facility/verify` (no wallet needed, just paste a Stellar address)
2. Keep the renter and landlord story in mind:
   - renter wants to qualify privately
   - landlord wants a yes/no answer

## Happy path (2 minutes)

Use these sample values:
- income: `5000`
- threshold: `3000`
- attestation type: `income`

Flow:
1. Connect a funded Stellar testnet wallet.
2. Open `Renter Input`.
3. Enter the private value.
4. Generate the commitment.
5. Generate the proof locally in the browser.
6. Submit the attestation on Stellar testnet.
7. Open `Landlord Verify`.
8. Check the wallet address.
9. Confirm the result shows:
   - qualified
   - requirement proven
   - issued date
   - expiry date

## Failure path (1 minute)

Use these sample values:
- income: `2500`
- threshold: `3000`
- attestation type: `income`

Expected outcome:
- proof generation should fail, or
- no valid passing attestation should be issued, and
- the verifier must not show a false-positive qualified result

## What to inspect on Stellar Expert

- the live contract address
- the attestation transaction from the happy path
- proof that the testnet deployment is real and queryable

Current contract:
- https://stellar.expert/explorer/testnet/contract/CDUXLEZQ6ZIQV3LN45VJOK5ONKRQOFFAIEK4JXPD63R2PDC5AF5VNJE3
## Live evidence (read this if you can't run anything)

See [`EVIDENCE.md`](./EVIDENCE.md) for:
- Real `./scripts/test-flow.sh` output against the deployed contract
- The previously recorded happy-path attestation tx (with stellar.expert link)
- A live failure-path simulation: `attest()` returns `false` on an invalid
  proof, and `get_attestation` for the same `(user, credit)` key stays `null`
  — so the contract genuinely enforces the threshold.

Real screenshots captured from the app live in:
- `docs/readme-screenshots/home.png` (Homepage)
- `docs/readme-screenshots/start.png` (Role Select)
- `docs/readme-screenshots/prove.png` (Renter Prove Page)
- `docs/readme-screenshots/qualified.png` (Qualified Renter Page)
- `docs/readme-screenshots/market.png` (Landlord Market Page)
- `docs/readme-screenshots/verify.png` (Landlord Verification Portal)

## If the prover takes time to load

The proof engine downloads heavy proving assets the first time.
For live judging:
- load the app once before the demo starts
- let the proving assets cache
- do not make the judge wait through a cold first-load if you can avoid it

## If the verification key needs to be refreshed

- open `/ops` in the frontend
- use `CHECK ON-CHAIN VK` to confirm whether the contract still has the placeholder key or an invalid-length VK upload
- if needed, use `EXPORT VERIFICATION KEY`, but only upload it if `/ops` reports `1760` bytes; save the file as `circuits/target/vk.bin`, then run `./scripts/update-vk.sh`
