# ProofPass Demo Script (2:30)

Goal: show that a renter can prove they qualify without exposing salary history, bank statements, or wallet activity.

Recording setup
- Browser already open at the frontend home page.
- Wallet extension installed and funded on Stellar testnet.
- Repo built already so `/zkproof.json` is available.
- If possible, keep one clean take with the wallet already authorized so signing popups do not eat the runtime.
- Browser zoom: 100%.
- Record at 1920x1080 fullscreen.

## 0:00-0:12 — Hook
On screen
- Start on the landing page hero.
- Keep the `ProofPass` title and the two CTAs visible.

Narration
"Landlords should not need your full financial life just to decide whether you qualify. ProofPass lets a renter prove they meet the requirement without exposing salary history, bank statements, or wallet activity."

## 0:12-0:28 — Explain the product in plain English
On screen
- Hover near the hero notes or scroll slightly and return to the top.

Narration
"The renter generates the proof locally in the browser. Stellar verifies it on-chain. The landlord sees only a yes-or-no qualification result, the threshold that was proven, and the expiry date. Nothing else is exposed."

## 0:28-0:42 — Connect wallet
On screen
- Click `CONNECT WALLET`.
- Select the wallet and connect.
- Briefly show the connected address state.

Narration
"The wallet anchors the attestation on Stellar testnet. It is not where the renter reveals private financial data. The sensitive input stays in the browser."

## 0:42-1:00 — Renter input
On screen
- Open `Renter Input`.
- In `#income-input`, enter `5000`.
- Keep the status panel visible.

Narration
"Here the renter enters private monthly income locally in the browser. For this demo, I am using five thousand dollars. This raw value never goes to a server and never goes on-chain."

## 1:00-1:12 — Generate commitment
On screen
- Click the Step 01 action button.
- Pause on the commitment status area.

Narration
"ProofPass first creates a commitment locally. That binds the private input cryptographically without disclosing it."

## 1:12-1:35 — Generate the proof
On screen
- Open `Generate Proof`.
- In `#threshold-input`, enter `3000` if needed.
- Click `#generate-proof-btn`.
- Let the progress UI and logs show the proof flow.

Narration
"Now the browser proves one specific claim: the renter's private income is at least three thousand dollars. The landlord does not learn the actual income. They only learn that the requirement was met."

## 1:35-1:55 — Issue the attestation on Stellar
On screen
- Open `Issue Attestation`.
- Click the on-chain attestation button.
- Approve the wallet signature.
- Pause on the success state and transaction hash.

Narration
"The Soroban contract verifies the proof on Stellar testnet and stores a time-bound attestation tied to the renter's wallet address."

## 1:55-2:15 — Landlord verify
On screen
- Open `Landlord Verify`.
- Paste the connected address if needed.
- Click `#check-attestation-btn`.
- Hold on the result card.

Narration
"The landlord now checks the address and sees only the answer they need: qualified or not, what threshold was proven, and when it expires. They never see the renter's underlying financial records."

## 2:15-2:25 — Failure case
On screen
- Briefly explain or cut to the failure setup.
- Show the sample values for the failure path: income `2500`, threshold `3000`.

Narration
"And if the renter is below the requirement, the proof path should fail or no passing attestation should be issued. That is why zero-knowledge is load-bearing here. The rule is enforced cryptographically, not by trust."

## 2:25-2:30 — Close
On screen
- Keep the successful landlord verification result visible or cut back to the hero.

Narration
"ProofPass turns rental qualification into a private yes-or-no check that anyone can understand and Stellar can verify."

## Demo-safe sample inputs
- Happy path: income `5000`, threshold `3000`, attestation type `income`
- Failure path: income `2500`, threshold `3000`, attestation type `income`

## Fast retake notes
- If wallet signing slows the take down, reconnect and pre-authorize before recording.
- If proof generation is slow on the machine, preload the app once so proving assets cache before the take.
- Keep Stellar Expert open in a second tab for the attestation transaction.
