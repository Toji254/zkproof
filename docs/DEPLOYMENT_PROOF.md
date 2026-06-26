# Deployment Proof

## Current testnet contract

- Contract ID: `CDUXLEZQ6ZIQV3LN45VJOK5ONKRQOFFAIEK4JXPD63R2PDC5AF5VNJE3`
- Explorer: https://stellar.expert/explorer/testnet/contract/CDUXLEZQ6ZIQV3LN45VJOK5ONKRQOFFAIEK4JXPD63R2PDC5AF5VNJE3

## Current frontend URL

- Add deployed frontend URL here once live

## Verification key status

- `scripts/update-vk.sh` uploads the real VK produced from the compiled Noir circuit
- `circuits/target/vk.bin` must exist before the upload step

## Recommended deployment sequence

```bash
./scripts/build.sh
./scripts/deploy.sh
./scripts/update-vk.sh
./scripts/test-flow.sh
```

## Preflight checklist

- testnet identity exists
- testnet account is funded
- `.contract-id` is produced after deploy
- `circuits/target/vk.bin` exists before VK upload
- frontend config points at the active testnet contract ID

## Smoke test command

```bash
./scripts/test-flow.sh
```

Expected result:
- contract responds on testnet
- registry read methods work
- deployment is real and queryable

## Known demo-safe sample inputs

- income: `5000`
- threshold: `3000`
- attestation type: `income`

## Known failure sample inputs

- income: `2500`
- threshold: `3000`
- attestation type: `income`

Expected result:
- proof should fail or no passing attestation should be issued

## What success looks like

`./scripts/build.sh`
- Noir tests pass
- `frontend/public/zkproof.json` is refreshed
- Soroban contract wasm builds

`./scripts/deploy.sh`
- `.contract-id` is created or updated
- contract is deployed to Stellar testnet

`./scripts/update-vk.sh`
- VK upload succeeds against the deployed contract

`./scripts/test-flow.sh`
- read-only smoke checks pass against the live contract
