# Judge Quickstart

## Open this first

1. Open the live demo.
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

## If the prover takes time to load

The proof engine downloads heavy proving assets the first time.
For live judging:
- load the app once before the demo starts
- let the proving assets cache
- do not make the judge wait through a cold first-load if you can avoid it
