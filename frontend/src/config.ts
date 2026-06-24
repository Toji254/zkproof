export interface SiteConfig {
  language: string
  siteTitle: string
  siteDescription: string
}

export interface NavigationLink {
  label: string
  href: string
}

export interface NavigationConfig {
  brandName: string
  links: NavigationLink[]
}

export interface HeroConfig {
  eyebrow: string
  titleLines: string[]
  leadText: string
  supportingNotes: string[]
}

export interface ManifestoConfig {
  videoPath: string
  fallbackImagePath?: string
  text: string
}

export interface FacilityArticle {
  title: string
  paragraphs: string[]
}

export interface FacilityItem {
  slug: string
  name: string
  code: string
  address: string
  status: string
  email: string
  phone: string
  ctaText: string
  ctaHref: string
  image: string
  utcOffset: number
  article: FacilityArticle
}

export interface FacilitiesConfig {
  sectionLabel: string
  detailBackText: string
  detailNotFoundText: string
  detailReturnText: string
  items: FacilityItem[]
}

export interface ObservationConfig {
  sectionLabel: string
  videoPath: string
  fallbackImagePath?: string
  statusText: string
  latLabel: string
  lonLabel: string
  initialLat: number
  initialLon: number
}

export interface ArchiveItem {
  src: string
  label: string
}

export interface ArchivesConfig {
  sectionLabel: string
  vaultTitle: string
  closeText: string
  items: ArchiveItem[]
}

export interface FooterConfig {
  copyrightText: string
  statusText: string
}

// ============================================================
// zkProof — Zero-Knowledge Financial Attestation Protocol
// ASCII Moon Observatory Theme Integration
// ============================================================

export const siteConfig: SiteConfig = {
  language: "en",
  siteTitle: "zkProof — ZK Financial Attestation on Stellar",
  siteDescription: "Generate verifiable financial attestations using zero-knowledge proofs on Stellar. Prove income, balance, or credit eligibility without revealing underlying data.",
}

export const navigationConfig: NavigationConfig = {
  brandName: "zkProof",
  links: [
    { label: "Protocol", href: "/#manifesto" },
    { label: "Process", href: "/#facilities" },
    { label: "Verify", href: "/facility/verify" },
    { label: "Stack", href: "/#archives" },
  ],
}

export const heroConfig: HeroConfig = {
  eyebrow: "Zero-Knowledge Financial Attestation on Stellar",
  titleLines: [
    "PROVE IT.",
    "WITHOUT",
    "SHOWING IT.",
  ],
  leadText: "Generate verifiable financial attestations using zero-knowledge proofs. Your data never leaves your browser. Verifiers get a YES or NO — nothing else.",
  supportingNotes: [
    "Noir circuits generate ZK proofs locally in your browser. Only the cryptographic attestation touches the blockchain.",
    "Soroban smart contracts verify BN254 pairing proofs on-chain. Tamper-proof attestations with 90-day validity.",
    "Renting, DeFi, freelancing, credit checks — prove eligibility without exposing bank statements, pay stubs, or balances.",
  ],
}

export const manifestoConfig: ManifestoConfig = {
  videoPath: "",
  fallbackImagePath: "/images/step2-proof.jpg",
  text: "Every day, millions of people are forced to expose their entire financial history just to pass simple eligibility checks. Landlords demand bank statements. Credit checks expose your full history. Cross-border freelancing requires proving source-of-funds by sharing everything. DeFi protocols need thresholds but don't want liability. The core tension is clear: institutions need verification, users need privacy. Today you can only have one. zkProof changes this. Built on Stellar using Noir zero-knowledge circuits and Soroban smart contracts, it lets users generate verifiable financial attestations. A Noir circuit generates a ZK proof that your income exceeds a threshold — without revealing the actual number. A Soroban verifier checks the proof on-chain using BN254 pairing verification. The result is an on-chain attestation — tamper-proof, expiring credential. The verifier gets YES or NO plus an expiry date. Nothing else.",
}

export const facilitiesConfig: FacilitiesConfig = {
  sectionLabel: "The Process",
  detailBackText: "BACK TO PROCESS",
  detailNotFoundText: "Step not found in the attestation pipeline.",
  detailReturnText: "Return to Process Overview",
  items: [
    {
      slug: "enter-data",
      name: "ENTER DATA",
      code: "STEP 01",
      address: "LOCAL BROWSER EXECUTION",
      status: "Privacy: Absolute — Data never leaves device",
      email: "INPUT: Income, Balance, Credit Score",
      phone: "OUTPUT: Poseidon Commitment",
      ctaText: "Launch Data Panel",
      ctaHref: "/facility/enter-data",
      image: "/images/step1-data.jpg",
      utcOffset: 0,
      article: {
        title: "Local Data Entry with Absolute Privacy",
        paragraphs: [
          "The user enters their financial data directly in the browser. This data never leaves the device — not to our servers, not to the blockchain, not anywhere. The entire process happens client-side.",
          "The input data is hashed using the Poseidon hash function, a ZK-friendly cryptographic primitive designed specifically for use in zero-knowledge circuits. This produces a commitment that will be used in the proof generation.",
          "The original data remains in the browser's memory only during the proof generation process and is immediately discarded. Even the user cannot recover the original input from the commitment alone.",
        ],
      },
    },
    {
      slug: "generate-proof",
      name: "GENERATE PROOF",
      code: "STEP 02",
      address: "NOIR CIRCUIT EXECUTION",
      status: "Circuit: BN254 + UltraHonk Backend",
      email: "INPUT: Witness + Threshold",
      phone: "OUTPUT: ZK Proof + Public Inputs",
      ctaText: "Open Proof Engine",
      ctaHref: "/facility/generate-proof",
      image: "/images/step2-proof.jpg",
      utcOffset: 0,
      article: {
        title: "Noir Circuit Generates Zero-Knowledge Proof",
        paragraphs: [
          "A Noir circuit takes the user's financial data as a private witness and the threshold as a public input. The circuit proves that the witness satisfies the constraint — for example, that income exceeds $3,000/month.",
          "The proof is generated using the UltraHonk backend, which produces a compact, non-interactive proof that can be verified efficiently. The entire process completes in under 5 seconds on modern hardware.",
          "The resulting proof reveals nothing about the actual income value. It only proves that some value, kept secret, satisfies the public constraint. This is the mathematical magic of zero-knowledge proofs.",
        ],
      },
    },
    {
      slug: "on-chain-attestation",
      name: "ON-CHAIN ATTEST",
      code: "STEP 03",
      address: "SOROBAN SMART CONTRACT",
      status: "Network: Stellar Testnet — 90 Day Validity",
      email: "INPUT: ZK Proof + Public Inputs",
      phone: "OUTPUT: Attestation Credential",
      ctaText: "Learn More",
      ctaHref: "/facility/on-chain-attestation",
      image: "/images/step3-chain.jpg",
      utcOffset: 0,
      article: {
        title: "Soroban Verifies and Issues Attestation",
        paragraphs: [
          "The ZK proof is submitted to a Soroban smart contract on the Stellar network. The contract performs BN254 pairing verification to check the proof's validity entirely on-chain.",
          "If verification succeeds, the contract issues an attestation credential — a tamper-proof record stored on the blockchain that anyone can query. The attestation includes the proof type, threshold, issue date, and expiry.",
          "The verifier can now check the attestation by simply querying the contract. They receive a YES or NO answer plus the expiry date. The original financial data remains completely hidden.",
        ],
      },
    },
    {
      slug: "verify",
      name: "VERIFY",
      code: "STEP 04",
      address: "QUERY ATTESTATION",
      status: "Result: YES/NO + Expiry Only",
      email: "INPUT: Stellar Address + Type",
      phone: "OUTPUT: Verification Result",
      ctaText: "Run Verification",
      ctaHref: "/facility/verify",
      image: "/images/step4-verify.jpg",
      utcOffset: 0,
      article: {
        title: "Anyone Can Verify Without Seeing Data",
        paragraphs: [
          "A verifier — such as a landlord, DAO governance system, or DeFi protocol — queries the Soroban contract with the user's Stellar address and the attestation type they want to verify.",
          "The contract returns a simple result: whether a valid attestation exists, what threshold was proven, when it was issued, and when it expires. The verifier learns nothing about the user's actual financial data.",
          "This creates a powerful new primitive for privacy-preserving finance. Users can prove eligibility for apartments, loans, DeFi pools, and cross-border payments without ever revealing sensitive financial information.",
        ],
      },
    },
  ],
}

export const observationConfig: ObservationConfig = {
  sectionLabel: "Live Verification Feed",
  videoPath: "",
  fallbackImagePath: "/images/step3-chain.jpg",
  statusText: "NETWORK ACTIVE — STELLAR TESTNET",
  latLabel: "LAT",
  lonLabel: "LON",
  initialLat: -14.23,
  initialLon: -51.92,
}

export const archivesConfig: ArchivesConfig = {
  sectionLabel: "Technology Stack",
  vaultTitle: "View All Technologies",
  closeText: "Close Vault",
  items: [
    {
      src: "/images/tech-noir.jpg",
      label: "Noir — ZK Circuit Language",
    },
    {
      src: "/images/tech-soroban.jpg",
      label: "Soroban — Stellar Smart Contracts",
    },
    {
      src: "/images/tech-stellar.jpg",
      label: "Stellar — L1 Blockchain",
    },
    {
      src: "/images/tech-bn254.jpg",
      label: "BN254 — Pairing Curve",
    },
  ],
}

export const footerConfig: FooterConfig = {
  copyrightText: "zkProof — Built for Stellar Hacks: Real-World ZK",
  statusText: "Powered by Noir · Soroban · BN254 · Poseidon",
}
