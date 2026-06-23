# zkProof — Zero-Knowledge Financial Attestation Protocol

> **"Prove it. Without showing it."**

## What is zkProof?

zkProof is a privacy-preserving financial attestation protocol built on [Stellar](https://stellar.org) using zero-knowledge proofs. It allows users to cryptographically prove financial eligibility (e.g., "my income exceeds $3,000/month") without revealing any underlying financial data.

## The Problem

Every day, millions of people are forced to expose their entire financial history just to pass simple eligibility checks:

- 🏠 **Renting?** Landlords demand bank statements, pay stubs, tax returns
- 💳 **Applying for services?** Credit checks expose your full history
- 🌍 **Freelancing cross-border?** Prove source-of-funds by sharing everything
- 🏦 **DeFi participation?** Protocols need thresholds but don't want liability

**The core tension:** Institutions need verification. Users need privacy. Today you can only have one.

## The Solution

zkProof lets users generate **verifiable financial attestations** on the Stellar network:

1. **User** enters financial data locally in browser (data **never** leaves)
2. **Noir circuit** generates a ZK proof: "Income exceeds threshold X"
3. **Soroban verifier** checks the proof on-chain using BN254 pairing verification
4. **Issues an on-chain attestation** — tamper-proof, expiring credential
5. **Verifier** (landlord, DAO, protocol) queries: gets **YES/NO + expiry**. Nothing else.

### What the verifier sees:
```
✅ Income > $3,000/month — Verified June 25, 2026 — Expires Sept 25, 2026
```

### What the verifier does NOT see:
```
❌ Exact income amount
❌ Bank name or account number  
❌ Employer name
❌ Transaction history
❌ Any personal financial data
```

## ZK is Load-Bearing

zkProof uses zero-knowledge proofs as a **genuinely load-bearing component** — without ZK cryptography, this product cannot exist. It is not a wrapper around existing functionality; it enables an entirely new category of privacy-preserving financial verification.

## Architecture

```
┌──────────────────────────────────────────────┐
│              USER (Prover)                    │
│  1. Connect Stellar wallet                    │
│  2. Enter financial data locally              │
│  3. Generate ZK proof in browser              │
│  ⚠ DATA NEVER LEAVES THE BROWSER             │
└──────────────────┬───────────────────────────┘
                   │ ZK Proof
                   ▼
┌──────────────────────────────────────────────┐
│         SOROBAN SMART CONTRACT                │
│  • BN254 pairing verification                 │
│  • Attestation registry                       │
│  • NO financial data on-chain                 │
└──────────────────┬───────────────────────────┘
                   │ Attestation
                   ▼
┌──────────────────────────────────────────────┐
│     VERIFIER (Landlord / DAO / Protocol)      │
│  • Query: "Does address X qualify?"           │
│  • Gets: YES/NO + timestamp + expiry          │
│  • Sees: NOTHING about actual finances        │
└──────────────────────────────────────────────┘
```

## Built With

- **[Noir](https://noir-lang.org/)** — ZK circuit language
- **[Soroban](https://soroban.stellar.org/)** — Stellar smart contracts (Rust)
- **BN254 + Poseidon** — Stellar Protocol 25/26 cryptographic primitives
- **React + Vite** — Frontend with client-side proof generation
- **bb.js (WASM)** — Browser-based proof generation via Barretenberg

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/zkproof.git
cd zkproof

# Build Noir circuit
cd circuits && nargo compile && cd ..

# Build & deploy Soroban contract
cd contracts && stellar contract build && cd ..

# Start frontend
cd frontend && npm install && npm run dev
```

## Demo

[📹 Watch the demo video](link-to-demo)

[🌐 Try the live testnet demo](link-to-demo)

## What's Next

- [ ] Additional attestation types (balance, credit score, debt-to-income)
- [ ] ASP (Association Set Provider) integration for compliance pools
- [ ] View key system for authorized auditor disclosure
- [ ] Post-quantum signature awareness (ML-DSA)
- [ ] Mobile proof generation

## Team

Built by [Your Name] for the [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk) hackathon.

## License

MIT
