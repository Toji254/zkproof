# Spec: ProofPass post-proof identity, sharing, and landlord ledger

## Objective
Add the first practical post-proof workflow to the app. A renter should receive a human-friendly public account ID, complete proof + on-chain attestation, and then share a verified wallet + attestation trail with a landlord. A landlord should be able to verify the renter, inspect authenticity links on Stellar Expert, and save the attestation as a local ledger record for later reference.

## Tech Stack
- Vite + React 19 + TypeScript
- Existing Stellar/Soroban integration in `frontend/src/lib/stellar.ts`
- Browser localStorage for MVP persistence until Supabase is added next

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Project Structure
- `frontend/src/pages/RoleSelect.tsx` — first-login role selection and account ID display
- `frontend/src/pages/ProveAttest.tsx` — renter proof flow, success/share UX
- `frontend/src/pages/FacilityDetail.tsx` — landlord verification portal and ledger save flow
- `frontend/src/lib/profile.ts` — local profile + ledger persistence for MVP
- `frontend/src/lib/explorer.ts` — Stellar Expert URL helpers

## Code Style
- Match existing inline-style page composition
- Keep new logic in focused helper modules rather than bloating page files
- Prefer additive changes and small UI slices over broad refactors

## Testing Strategy
- TypeScript build must pass
- ESLint must pass on touched files if project lint baseline allows
- Manual smoke path:
  1. open `/start`
  2. choose renter, confirm public ID
  3. complete proof, confirm share panel + explorer links
  4. open landlord verify flow with shared query params
  5. save verified attestation into ledger and confirm record list renders

## Boundaries
- Always: keep proof/authenticity data real, use real explorer URLs, preserve current wallet/proof behavior
- Ask first: adding a backend service, changing contract interfaces, generating custodial wallets
- Never: fake on-chain data, invent explorer paths that do not exist, store secrets

## Success Criteria
- A renter and landlord each get a stable local public ID the first time they enter their flow
- Renter success screen shows public ID, wallet, tx link, contract link, and a share action
- Landlord verify screen can be prefilled from renter share data
- Verified result includes clickable Stellar Expert links for tx/account/contract where available
- Landlord can save a verified attestation to a persistent local ledger and see saved records

## Open Questions
- Supabase-backed uniqueness and multi-device sync come next
- Proof hash is shown as an immutable reference, but Stellar Expert cannot deep-link directly to a proof hash itself