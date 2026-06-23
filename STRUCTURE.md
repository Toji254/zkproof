# zkProof Project Structure

This is the monorepo for the zkProof hackathon project.

## Directory Structure

```
zkproof/
├── README.md                    # Main README (hackathon submission)
├── circuits/                    # Noir ZK circuits
│   ├── Nargo.toml              # Noir project config
│   ├── Prover.toml             # Example prover inputs
│   └── src/
│       └── main.nr             # Income range proof circuit
├── contracts/                   # Soroban smart contracts
│   ├── Cargo.toml              # Rust dependencies
│   └── src/
│       └── lib.rs              # Verifier + attestation registry
├── frontend/                    # React + Vite frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx            # Entry point
│       ├── App.jsx             # Main application
│       └── index.css           # Design system
└── CODEX_PROMPTS.md            # Prompts for Codex to do heavy lifting
```
