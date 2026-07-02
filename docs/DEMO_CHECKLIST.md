# Demo Checklist

## Before recording

- open the live app once
- connect the wallet once
- make sure proving assets have already downloaded
- confirm the testnet contract link works
- confirm the UI matches the README screenshots

## Before a live walkthrough

- preload the app in a browser tab
- keep Stellar Expert open in a second tab
- have the funded testnet wallet unlocked
- keep one backup video ready in case RPC or wallet popups are slow

## Warm-up actions

- open the renter flow
- wait for any prover assets to finish caching
- confirm the wallet is connected
- confirm the landlord verify screen loads cleanly

## Happy-path sample inputs

- income: `5000`
- threshold: `3000`
- attestation type: `income`

## Failure-path sample inputs

- income: `2500`
- threshold: `3000`
- attestation type: `income`

## Backup flow if wallet popup is slow

- show the preloaded happy-path video
- show the live contract on Stellar Expert
- explain that the wallet is only the signing surface and the proof still originates in-browser

## Final walkthrough checklist

- [ ] No placeholder links remain
- [ ] README hero matches landing hero
- [ ] Live demo works on testnet
- [ ] Failure case is documented and demoable
- [ ] Quickstart is accurate
- [ ] Contract link opens correctly
- [ ] Screenshots reflect current UI
