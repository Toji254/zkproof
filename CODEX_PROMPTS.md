# 🤖 Codex Prompts for zkProof — Heavy Lifting Tasks

> **IMPORTANT:** Copy-paste these prompts into Codex one at a time. Each prompt is self-contained and specifies exactly what to do, where, and what NOT to touch.

---

## PROMPT 1: Wire Up BN254 UltraHonk Proof Verification in Soroban Contract

```
TASK: Implement real BN254 ZK proof verification in the existing Soroban smart contract.

CONTEXT: I'm building "zkProof" — a ZK financial attestation protocol for the Stellar Hacks hackathon. The project is located at ~/zkproof/. The Soroban contract is at ~/zkproof/contracts/src/lib.rs. It currently has a placeholder `verify_proof()` function that needs to be replaced with real BN254 pairing check verification using Soroban's `env.crypto().bls12_381()` host functions.

WHAT TO DO:
1. In ~/zkproof/contracts/src/lib.rs, replace the `verify_proof()` function (currently a placeholder that just checks proof length) with real UltraHonk proof verification.
2. Reference the pattern from https://github.com/yugocabrio/rs-soroban-ultrahonk for how to structure the BN254 pairing check on Soroban.
3. The verification should:
   - Parse the proof bytes into G1/G2 points
   - Extract public inputs (minimum_threshold, attestation_type, timestamp, data_commitment)
   - Perform the BN254 pairing check using env.crypto().bls12_381().pairing_check()
   - Return true/false
4. Add a `store_verification_key()` admin function that stores the circuit's verification key on-chain (this is generated when you compile the Noir circuit).
5. Update the `attest()` function to pass public inputs to the verifier.
6. Update the Cargo.toml if any additional dependencies are needed.

WHAT NOT TO CHANGE:
- Do NOT modify the Attestation struct, AttestationKey struct, or DataKey enum
- Do NOT change the `check()`, `get_attestation()`, `revoke()`, or `total_attestations()` functions
- Do NOT change the test structure — add new tests for the verifier but keep existing ones
- Do NOT rename the contract or change the module structure

FILES TO MODIFY:
- ~/zkproof/contracts/src/lib.rs (modify verify_proof, add store_verification_key)
- ~/zkproof/contracts/Cargo.toml (if dependencies needed)

ACCEPTANCE CRITERIA:
- `cargo build --target wasm32-unknown-unknown --release` succeeds
- `cargo test` passes (both old and new tests)
- The verify_proof function uses env.crypto().bls12_381().pairing_check()
- A store_verification_key admin function exists
- Public inputs are properly extracted and used in verification
```

---

## PROMPT 2: Implement Browser-Side ZK Proof Generation with bb.js

```
TASK: Add client-side ZK proof generation to the React frontend using bb.js (Barretenberg) WASM.

CONTEXT: I'm building "zkProof" — a ZK financial attestation protocol. The frontend is at ~/zkproof/frontend/ (React + Vite). The Noir circuit is at ~/zkproof/circuits/src/main.nr. Currently, the App.jsx has a mock proof generation (setTimeout) that needs to be replaced with real bb.js WASM proof generation.

WHAT TO DO:
1. Create a new file ~/zkproof/frontend/src/lib/prover.js that handles all ZK proof generation logic.
2. This file should:
   a. Import and initialize bb.js (from @aztec/bb.js) WASM module
   b. Load the compiled Noir circuit (the circuit JSON artifact from nargo compile)
   c. Accept user inputs: { monthly_income, data_source_secret, minimum_threshold, attestation_type, timestamp }
   d. Compute the Poseidon commitment: poseidon_bn254_hash_2(data_source_secret, monthly_income)
   e. Generate the witness from the inputs
   f. Generate an UltraHonk proof using bb.js
   g. Return { proof: Uint8Array, publicInputs: Array, proofHash: string }
3. Create ~/zkproof/frontend/src/lib/poseidon.js that computes Poseidon hashes client-side (needed for the data_commitment public input)
4. Update ~/zkproof/frontend/src/App.jsx:
   - Replace the mock setTimeout in the `generateProof` function with a call to the real prover
   - Update the ProgressStep components to show real progress
   - Handle errors from proof generation gracefully
5. Update ~/zkproof/frontend/package.json to add @aztec/bb.js and @noir-lang/noir_js dependencies
6. Update ~/zkproof/frontend/vite.config.js if WASM loading needs configuration

WHAT NOT TO CHANGE:
- Do NOT modify ~/zkproof/frontend/src/index.css (the design system)
- Do NOT change the overall App component structure (LandingView, ProveView, VerifyView)
- Do NOT modify the VerifyView or LandingView components
- Do NOT change the navbar, footer, or layout
- Do NOT remove the privacy-banner or any existing UI text

FILES TO CREATE:
- ~/zkproof/frontend/src/lib/prover.js
- ~/zkproof/frontend/src/lib/poseidon.js

FILES TO MODIFY:
- ~/zkproof/frontend/src/App.jsx (only the generateProof function in ProveView)
- ~/zkproof/frontend/package.json (add dependencies)
- ~/zkproof/frontend/vite.config.js (WASM support if needed)

ACCEPTANCE CRITERIA:
- `npm run dev` starts without errors
- Clicking "Generate ZK Proof" runs real bb.js proof generation
- The proof generation progress steps update in real-time
- The generated proof is a real UltraHonk proof (not mock data)
- If bb.js fails to load (WASM issues), fall back to the mock proof with a console warning
- The Poseidon commitment matches what the Noir circuit expects
```

---

## PROMPT 3: Stellar Wallet Integration + Soroban Transaction Building

```
TASK: Wire up real Stellar Freighter wallet connection and Soroban contract interaction in the frontend.

CONTEXT: I'm building "zkProof" at ~/zkproof/. The frontend at ~/zkproof/frontend/ currently has mock wallet connection and mock contract queries. I need real Freighter wallet integration and Soroban transaction building.

WHAT TO DO:
1. Create ~/zkproof/frontend/src/lib/stellar.js with these functions:
   a. connectWallet() — Connect to Freighter, return public key. Handle cases where Freighter is not installed (show install prompt).
   b. disconnectWallet() — Clear wallet state
   c. submitAttestation(proof, publicInputs, attestationType, threshold) — Build and submit a Soroban transaction that calls the `attest()` function on our deployed contract. Use @stellar/stellar-sdk to:
      - Create a Transaction with the user's account
      - Add the contract invocation operation
      - Simulate the transaction first
      - Submit via Freighter signing
      - Return the transaction hash
   d. checkAttestation(address, attestationType) — Call the `check()` function as a read-only contract query. Return { valid: boolean, attestation: object | null }
   e. getAttestationDetails(address, attestationType) — Call `get_attestation()` read-only

2. Create ~/zkproof/frontend/src/lib/config.js with:
   - CONTRACT_ID (placeholder, will be set after deployment)
   - NETWORK = 'TESTNET'
   - NETWORK_PASSPHRASE
   - RPC_URL = 'https://soroban-testnet.stellar.org'

3. Update ~/zkproof/frontend/src/App.jsx:
   - Replace the mock connectWallet with real Freighter connection from stellar.js
   - In ProveView, after proof generation, call submitAttestation() to submit the proof on-chain
   - In VerifyView, replace the mock check with real checkAttestation() call
   - Add proper error handling and loading states for all blockchain operations

WHAT NOT TO CHANGE:
- Do NOT modify ~/zkproof/frontend/src/index.css
- Do NOT change the component structure or layout
- Do NOT remove the demo/fallback mode (if Freighter is not installed, the app should still work with mock data)
- Do NOT change the LandingView component

FILES TO CREATE:
- ~/zkproof/frontend/src/lib/stellar.js
- ~/zkproof/frontend/src/lib/config.js

FILES TO MODIFY:
- ~/zkproof/frontend/src/App.jsx (wallet connection + contract calls)

ACCEPTANCE CRITERIA:
- If Freighter is installed: real wallet connection works, transactions are built and signed
- If Freighter is NOT installed: graceful fallback to demo mode with mock data
- Contract calls use proper Soroban SDK patterns (simulate before submit)
- Error messages are user-friendly (not raw blockchain errors)
- config.js has a clearly marked CONTRACT_ID placeholder
```

---

## PROMPT 4: GSAP Animations + Interactive Demo Tour

```
TASK: Add premium GSAP animations and an interactive demo tour to the zkProof frontend.

CONTEXT: The zkProof frontend is at ~/zkproof/frontend/. It uses React + Vite with GSAP already in package.json. I need scroll-triggered animations and a guided demo tour similar to what I built in my MatchStake project (auto-tour that walks users through the UI).

WHAT TO DO:
1. Create ~/zkproof/frontend/src/components/DemoTour.jsx:
   - An interactive guided tour component that highlights key UI elements
   - Steps: (1) Welcome/intro, (2) Connect wallet, (3) Enter income data, (4) Generate proof, (5) View attestation, (6) Switch to Verifier view, (7) Check attestation
   - Each step should have a tooltip/popover pointing to the relevant UI element
   - Include "Next", "Back", "Skip" buttons
   - Auto-advance option for demo video recording
   - Store tour completion in localStorage so it only shows once

2. Create ~/zkproof/frontend/src/hooks/useAnimations.js:
   - Custom React hook that sets up GSAP ScrollTrigger animations
   - Animate: hero text (staggered fade-in), step cards (slide-up on scroll), stat numbers (count-up animation), result card (scale-in)
   - Add a subtle parallax effect on the hero background gradient
   - Add hover micro-animations on cards (slight scale + glow)

3. Update ~/zkproof/frontend/src/App.jsx:
   - Import and render <DemoTour /> at the app level
   - Add unique IDs to key elements for the tour to target: 
     id="connect-wallet-btn", id="prove-section", id="verify-section", 
     id="income-input", id="threshold-input", id="generate-proof-btn"
   - Apply the useAnimations hook

4. Update ~/zkproof/frontend/src/index.css:
   - Add styles for the tour tooltip/popover (dark glass style matching the theme)
   - Add a .tour-highlight class that adds a pulsing border around targeted elements
   - Add tour overlay styles (semi-transparent dark backdrop)

WHAT NOT TO CHANGE:
- Do NOT modify the Soroban contract (~/zkproof/contracts/)
- Do NOT modify the Noir circuit (~/zkproof/circuits/)
- Do NOT change the core business logic in App.jsx (proof generation, wallet connection, verification)
- Do NOT change the color scheme or design tokens in index.css (only ADD new styles)
- Do NOT remove any existing CSS classes

FILES TO CREATE:
- ~/zkproof/frontend/src/components/DemoTour.jsx
- ~/zkproof/frontend/src/hooks/useAnimations.js

FILES TO MODIFY:
- ~/zkproof/frontend/src/App.jsx (add IDs, import tour + animations)
- ~/zkproof/frontend/src/index.css (add tour styles — APPEND ONLY, do not modify existing)

ACCEPTANCE CRITERIA:
- Tour launches on first visit, showing step-by-step walkthrough
- Tour tooltip is dark glass style matching the existing design
- GSAP animations are smooth and performant (no jank)
- Stat numbers animate counting up when scrolled into view
- Cards animate in with staggered delays
- Tour can be dismissed and won't show again (localStorage)
- All animations respect prefers-reduced-motion
```

---

## PROMPT 5: Testnet Deployment Scripts

```
TASK: Create deployment scripts for the zkProof Soroban contract to Stellar testnet.

CONTEXT: The project is at ~/zkproof/. The Soroban contract is at ~/zkproof/contracts/. I need scripts to compile, deploy, and initialize the contract on Stellar testnet, plus scripts to compile the Noir circuit.

WHAT TO DO:
1. Create ~/zkproof/scripts/setup.sh:
   - Check for required tools (stellar CLI, nargo, cargo, node)
   - Install missing tools with clear instructions
   - Generate a Stellar testnet keypair if one doesn't exist
   - Fund the account from friendbot
   - Print the public key and testnet explorer link

2. Create ~/zkproof/scripts/build.sh:
   - Build the Noir circuit: cd circuits && nargo compile
   - Build the Soroban contract: cd contracts && stellar contract build
   - Print success/failure status for each

3. Create ~/zkproof/scripts/deploy.sh:
   - Deploy the compiled WASM to Stellar testnet using stellar contract deploy
   - Initialize the contract by calling the initialize() function
   - Store the contract ID in ~/zkproof/frontend/src/lib/config.js (update the CONTRACT_ID)
   - Also store it in ~/zkproof/.contract-id for other scripts
   - Print the contract ID and testnet explorer link

4. Create ~/zkproof/scripts/test-flow.sh:
   - Run a complete end-to-end test on testnet:
     a. Call attest() with a mock proof
     b. Call check() to verify the attestation exists
     c. Call get_attestation() to see details
     d. Call revoke() to remove it
     e. Call check() again to confirm it's gone
   - Print results at each step

5. Create ~/zkproof/scripts/demo.sh:
   - Start the frontend dev server
   - Open the browser to http://localhost:3000
   - Print a message about the demo tour

WHAT NOT TO CHANGE:
- Do NOT modify any source code files (contracts, circuits, frontend)
- Do NOT change the project structure
- Scripts should be idempotent (safe to run multiple times)

FILES TO CREATE:
- ~/zkproof/scripts/setup.sh
- ~/zkproof/scripts/build.sh  
- ~/zkproof/scripts/deploy.sh
- ~/zkproof/scripts/test-flow.sh
- ~/zkproof/scripts/demo.sh

ACCEPTANCE CRITERIA:
- All scripts have proper shebang (#!/bin/bash) and are executable (chmod +x)
- All scripts have clear echo statements explaining what's happening
- deploy.sh automatically updates the CONTRACT_ID in frontend config
- Scripts handle errors gracefully with clear error messages
- Scripts are idempotent
- Each script can be run independently
```

---

## PROMPT 6: Polish & Demo Video Assets

```
TASK: Create final polish assets for the zkProof hackathon submission.

CONTEXT: zkProof is at ~/zkproof/. It's a ZK financial attestation protocol for the Stellar Hacks: Real-World ZK hackathon. I need final polish for submission.

WHAT TO DO:
1. Create ~/zkproof/frontend/public/og-image.html:
   - A standalone HTML page that renders a beautiful OG image (1200x630px)
   - Dark background matching the app theme
   - Shows: "zkProof" logo, tagline "Prove It. Without Showing It.", and "Built on Stellar" badge
   - This will be screenshotted for social preview

2. Update ~/zkproof/README.md:
   - Add badges at the top: Built with Noir, Deployed on Stellar, License MIT
   - Add a "Screenshots" section with placeholder image paths
   - Add a "Video Demo" section with placeholder YouTube link
   - Add a "Technical Deep Dive" section explaining:
     a. How the Noir circuit works (link to circuits/src/main.nr)
     b. How the Soroban verifier works (link to contracts/src/lib.rs)
     c. How client-side proving works
     d. Why ZK is load-bearing (critical — echo judges' criteria)
   - Add "Contributing" and "License" sections
   - Make sure the README is submission-ready for DoraHacks

3. Create ~/zkproof/.gitignore:
   - Standard Rust + Node + Noir ignores
   - Ignore node_modules, target, dist, .env files
   - Ignore Noir compilation artifacts (circuits/target/)
   - Keep .contract-id tracked

4. Create ~/zkproof/DEMO_SCRIPT.md:
   - A step-by-step script for recording the 2:30 demo video
   - Include exact narration text for each section
   - Include which UI elements to click and when
   - Include timing marks (0:00-0:15 hook, 0:15-0:35 problem, etc.)

WHAT NOT TO CHANGE:
- Do NOT modify any source code (contracts, circuits, frontend src)
- Do NOT change package.json or Cargo.toml files

FILES TO CREATE:
- ~/zkproof/frontend/public/og-image.html
- ~/zkproof/.gitignore
- ~/zkproof/DEMO_SCRIPT.md

FILES TO MODIFY:
- ~/zkproof/README.md (enhance for submission)

ACCEPTANCE CRITERIA:
- README looks professional and submission-ready
- .gitignore covers all build artifacts
- Demo script has exact timing and narration
- OG image page renders a clean social preview
```
