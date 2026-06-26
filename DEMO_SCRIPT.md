# zkProof Demo Script (2:30)

Goal: show that zkProof lets a user prove financial eligibility on Stellar without revealing the underlying financial data.

Recording setup
- Browser already open at the frontend home page.
- Wallet extension installed and funded on Stellar testnet.
- Repo built already so `/zkproof.json` is available.
- If possible, keep one clean take with the wallet already authorized so signing popups do not eat the runtime.
- Browser zoom: 100%.
- Record at 1920x1080 fullscreen.

## 0:00-0:15 — Hook
On screen
- Start on the landing page hero.
- Keep the `zkProof` title and the `CONNECT WALLET` button visible.

Narration
"What if you could prove you qualify financially without exposing your bank statements, salary, or transaction history? zkProof does exactly that. It uses zero-knowledge proofs on Stellar so the verifier gets a yes-or-no answer, and nothing else."

Action
- No click yet. Let the hero breathe for 2-3 seconds.

## 0:15-0:35 — Problem + why now
On screen
- Scroll slightly so the homepage still feels alive, then return to the hero if needed.

Narration
"Today, landlords, lenders, and on-chain apps usually force users to overshare sensitive financial data just to pass a threshold check. That is a broken tradeoff. zkProof turns that check into a privacy-preserving attestation that can be verified on-chain."

Action
- Move cursor toward `CONNECT WALLET`.

## 0:35-0:50 — Connect wallet
On screen
- Click `CONNECT WALLET` (`#connect-wallet-btn`).
- In the wallet picker, select the installed wallet and connect.
- After connection, briefly show the connected address state in the header.

Narration
"First, the user connects a Stellar wallet. zkProof uses the wallet as the identity anchor for the attestation that will be written to Soroban."

## 0:50-1:10 — Enter private data locally
On screen
- Navigate to Step 01 / `ENTER DATA` using the Process section card or go directly to `/facility/enter-data`.
- Click into `#income-input` and type `5000`.
- Keep the right-hand logs/status area visible.

Narration
"Here the user enters private financial data locally in the browser. In this example, I am using a monthly income of five thousand dollars. This raw value never goes to a server and never goes on-chain."

## 1:10-1:25 — Generate commitment
On screen
- Click the Step 01 action button that generates the commitment.
- Pause on the logs when the Poseidon commitment appears.

Narration
"zkProof first computes a Poseidon commitment client-side. That binds the private value cryptographically without disclosing it, and prepares the input for proof generation."

## 1:25-1:50 — Generate the zero-knowledge proof
On screen
- Navigate to Step 02 / `GENERATE PROOF`.
- In `#threshold-input`, enter `3000` if it is not already filled.
- Click `#generate-proof-btn`.
- Let the progress UI and logs show witness execution, UltraHonk proving, and proof generation.

Narration
"Next, the Noir circuit proves one very specific claim: my private income is greater than the public threshold of three thousand dollars. The proof is generated in the browser with Barretenberg and UltraHonk, so the verifier learns the claim is true without learning the actual income."

## 1:50-2:10 — Submit on-chain attestation
On screen
- As soon as proof generation completes, click the on-chain attest action in Step 03.
- Approve the wallet signature.
- Pause long enough for the success state and transaction hash to appear.

Narration
"Now I submit that proof to the Soroban verifier contract on Stellar testnet. The contract verifies the proof on-chain and issues a time-bound attestation tied to this wallet address."

## 2:10-2:25 — Verify with zero data leakage
On screen
- Navigate to Step 04 / `VERIFY`, or click the `VERIFY` nav button on the homepage (`#verify-nav-btn`) before this section if you want a smoother cut.
- In `#verify-address-input`, paste the connected Stellar address if it is not already populated.
- Click `#check-attestation-btn`.
- Hold on the result card showing a valid attestation, threshold, issued date, expiry, and proof hash.

Narration
"A verifier now checks the address on-chain and gets only the attestation result: valid or not, what threshold was proven, and when it expires. They do not get the salary, account history, employer, or any underlying financial records."

## 2:25-2:30 — Close
On screen
- Keep the successful verification result visible.

Narration
"That is zkProof: privacy-preserving financial eligibility, verified with zero-knowledge proofs, and settled on Stellar."

## Fast retake notes
- If wallet signing slows the take down, reconnect and pre-authorize before recording.
- If proof generation is slow on the machine, start the click slightly earlier and let the logs carry the middle of the narration.
- Best proof demo values: income `5000`, threshold `3000`, attestation type `income`.
