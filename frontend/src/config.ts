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
  siteTitle: "ProofPass by zkProof — Private Rental Qualification on Stellar",
  siteDescription: "ProofPass lets a renter prove they meet a landlord's requirement without exposing salary history, bank statements, or wallet activity.",
}

export const navigationConfig: NavigationConfig = {
  brandName: "ProofPass",
  links: [
    { label: "Why", href: "/#manifesto" },
    { label: "How It Works", href: "/#facilities" },
    { label: "Prove", href: "/prove" },
    { label: "Landlord Verify", href: "/facility/verify" },
  ],
}

export const heroConfig: HeroConfig = {
  eyebrow: "Private rental qualification on Stellar",
  titleLines: [
    "PROVE YOU",
    "QUALIFY.",
    "REVEAL NOTHING.",
  ],
  leadText: "ProofPass lets a renter prove they meet a landlord's requirement without exposing salary history, bank statements, or wallet activity.",
  supportingNotes: [
    "Generate the proof locally in your browser. Sensitive data never leaves your device.",
    "Soroban verifies the proof on Stellar testnet and records a tamper-proof attestation with an expiry date.",
    "The landlord sees only YES / NO, the proven threshold, and whether the attestation is still valid.",
  ],
}

export const manifestoConfig: ManifestoConfig = {
  videoPath: "",
  fallbackImagePath: "/images/step2-proof.jpg",
  text: "Landlords should not need your full financial history to decide whether you qualify. ProofPass turns that invasive check into a private yes/no attestation. The renter generates a proof locally, the Soroban contract verifies it on Stellar, and the landlord sees only whether the requirement was met, what threshold was proven, and when the attestation expires. The salary, bank statement, wallet history, and underlying witness data never leave the renter's device.",
}

export const facilitiesConfig: FacilitiesConfig = {
  sectionLabel: "How It Works",
  detailBackText: "BACK TO FLOW",
  detailNotFoundText: "Step not found in the renter qualification flow.",
  detailReturnText: "Return to Flow Overview",
  items: [
    {
      slug: "enter-data",
      name: "RENTER INPUT",
      code: "STEP 01",
      address: "PRIVATE BROWSER SESSION",
      status: "Private — the renter's raw data never leaves the device",
      email: "Renter enters income, balance, or credit data locally",
      phone: "Output: a private commitment tied to this session",
      ctaText: "Prove qualification",
      ctaHref: "/prove",
      image: "/images/step1-data.jpg",
      utcOffset: 0,
      article: {
        title: "The renter enters private financial data locally",
        paragraphs: [
          "The renter enters the private value directly in the browser. For the hero demo, that value is monthly income used for rental pre-qualification.",
          "Nothing is uploaded to a server and nothing is written on-chain at this stage. The app derives a commitment locally so the later proof is bound to this exact private input without revealing it.",
          "This is the key privacy promise of ProofPass: the landlord never receives the renter's bank statement, salary history, transaction history, or other raw financial records.",
        ],
      },
    },
    {
      slug: "generate-proof",
      name: "GENERATE PROOF",
      code: "STEP 02",
      address: "LOCAL PROOF ENGINE",
      status: "Browser-side proof generation with Noir + Barretenberg",
      email: "Input: renter data + landlord threshold",
      phone: "Output: zero-knowledge proof + public attestation inputs",
      ctaText: "Prove qualification",
      ctaHref: "/prove",
      image: "/images/step2-proof.jpg",
      utcOffset: 0,
      article: {
        title: "The browser proves the renter meets the requirement",
        paragraphs: [
          "The renter chooses the public requirement they want to satisfy — for example, proving monthly income is at least 3,000 for a landlord screening check.",
          "A Noir circuit turns that into a zero-knowledge proof. The proof says the requirement was met without disclosing the renter's actual number.",
          "If the renter is below the threshold, the proof path should fail. That failure case matters because it shows the rule is enforced by the circuit itself, not by trust or presentation logic.",
        ],
      },
    },
    {
      slug: "on-chain-attestation",
      name: "ISSUE ATTESTATION",
      code: "STEP 03",
      address: "SOROBAN CONTRACT ON TESTNET",
      status: "Stellar testnet attestation with 90-day validity",
      email: "Input: proof + attestation inputs",
      phone: "Output: tamper-proof qualification record",
      ctaText: "Prove qualification",
      ctaHref: "/prove",
      image: "/images/step3-chain.jpg",
      utcOffset: 0,
      article: {
        title: "Stellar records the private qualification result",
        paragraphs: [
          "The proof is submitted to a Soroban smart contract on Stellar testnet. The contract verifies the proof on-chain and rejects invalid or inconsistent inputs.",
          "If verification succeeds, the contract stores a reusable attestation tied to the renter's wallet address, the requirement type, and an expiry window.",
          "That gives landlords and other verifiers a tamper-proof way to check qualification later without ever handling the renter's raw financial data.",
        ],
      },
    },
    {
      slug: "verify",
      name: "LANDLORD VERIFY",
      code: "STEP 04",
      address: "VERIFIER PORTAL",
      status: "YES / NO + threshold + expiry only",
      email: "Input: renter address + requirement type",
      phone: "Output: qualification result without disclosure",
      ctaText: "Landlord verify",
      ctaHref: "/facility/verify",
      image: "/images/step4-verify.jpg",
      utcOffset: 0,
      article: {
        title: "The landlord gets the answer without seeing the renter's life",
        paragraphs: [
          "The verifier enters the renter's address and checks whether a valid rental qualification attestation exists for the chosen requirement type.",
          "The result is intentionally simple: qualified or not, what threshold was proven, when it was issued, and when it expires. The verifier never sees the renter's salary, balances, account history, or source documents.",
          "That is what makes ProofPass useful beyond crypto. The same pattern can later work for visas, scholarships, freelancers, or loan pre-checks, but the landlord flow is the clearest first use case.",
        ],
      },
    },
  ],
}

export const observationConfig: ObservationConfig = {
  sectionLabel: "Live Verification View",
  videoPath: "",
  fallbackImagePath: "/images/step3-chain.jpg",
  statusText: "STELLAR TESTNET — QUALIFICATION CHECKS LIVE",
  latLabel: "REQ",
  lonLabel: "EXP",
  initialLat: -14.23,
  initialLon: -51.92,
}

export const archivesConfig: ArchivesConfig = {
  sectionLabel: "Technology Stack",
  vaultTitle: "Why judges can trust this",
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
  copyrightText: "ProofPass by zkProof — Built for Stellar Hacks: Real-World ZK",
  statusText: "Private qualification on Stellar · Noir · Soroban · Poseidon",
}
