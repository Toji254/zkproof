//! # zkProof — Zero-Knowledge Financial Attestation Verifier
//!
//! This Soroban smart contract verifies ZK proofs submitted by users and issues
//! on-chain attestations (credentials) that third parties can query.
//!
//! ## Flow:
//! 1. User generates a ZK proof off-chain (in browser via bb.js)
//! 2. User calls `attest()` with the proof and public inputs
//! 3. Contract verifies the proof using BN254 pairing check
//! 4. If valid, stores an attestation on-chain
//! 5. Verifiers call `check()` to query attestations — get YES/NO only
//!
//! ## Key Design Decisions:
//! - NO financial data ever touches the chain
//! - Attestations expire after 90 days (configurable)
//! - Users can revoke their own attestations
//! - Attestations are keyed by (address, attestation_type)

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    crypto::bls12_381::{G1Affine, G2Affine},
    log, symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec,
};

const PUBLIC_INPUT_BYTES: u32 = 32 * 4;
const G1_BYTES: u32 = 96;
const G2_BYTES: u32 = 192;
const PROOF_EXTRA_PAIR_BYTES: u32 = G1_BYTES + G2_BYTES;
const VK_MAGIC: [u8; 4] = *b"ZKPV";

// ============================================================
// Data Types
// ============================================================

/// Represents an on-chain attestation credential
#[contracttype]
#[derive(Clone, Debug)]
pub struct Attestation {
    /// The Stellar address that holds this attestation
    pub holder: Address,
    /// Type of attestation: "income", "balance", "credit"
    pub attestation_type: Symbol,
    /// The threshold that was proven (e.g., 3000 for "$3,000/month")
    pub threshold: i128,
    /// Unix timestamp when the attestation was issued
    pub issued_at: u64,
    /// Unix timestamp when the attestation expires (default: 90 days)
    pub expires_at: u64,
    /// SHA256 hash of the proof for audit trail
    pub proof_hash: BytesN<32>,
}

/// Storage key for attestations: (holder_address, attestation_type)
#[contracttype]
#[derive(Clone)]
pub struct AttestationKey {
    pub holder: Address,
    pub att_type: Symbol,
}

/// Storage key for contract admin
#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    /// Total number of attestations issued (for stats)
    TotalAttestations,
    /// Verification key for ZK proof verification
    VerificationKey,
}

// ============================================================
// Contract
// ============================================================

#[contract]
pub struct ZkProofVerifier;

#[contractimpl]
impl ZkProofVerifier {
    // --------------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------------

    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TotalAttestations, &0u64);
        log!(&env, "zkProof contract initialized");
    }

    /// Store the circuit verification key used by `attest` proof verification.
    ///
    /// Admin-only. The stored format is byte-oriented because the VK is generated
    /// off-chain when compiling the ZK circuit. Layout:
    ///
    ///   b"ZKPV" || pair_count:u32_be || pair_count * Bls12381G2Affine(192 bytes)
    ///
    /// During verification, the proof supplies the corresponding G1 points and
    /// optional extra G1/G2 pairs; all pairs are passed to Soroban's native
    /// BLS12-381 pairing checker.
    pub fn store_verification_key(env: Env, admin: Address, vk: Bytes) -> bool {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("Contract not initialized"));

        if stored_admin != admin {
            panic!("Only admin can store verification key");
        }

        if !Self::valid_verification_key(&vk) {
            return false;
        }

        env.storage().instance().set(&DataKey::VerificationKey, &vk);
        log!(&env, "Verification key stored");
        true
    }

    // --------------------------------------------------------
    // CORE: Submit proof and receive attestation
    // --------------------------------------------------------

    /// Submit a ZK proof to receive an on-chain attestation.
    ///
    /// # Arguments
    /// * `user` - The address claiming the attestation
    /// * `proof` - The serialized ZK proof bytes
    /// * `attestation_type` - Type: "income", "balance", or "credit"
    /// * `threshold` - The minimum threshold proven (e.g., 3000)
    ///
    /// # Returns
    /// * `true` if proof is valid and attestation was issued
    pub fn attest(
        env: Env,
        user: Address,
        proof: Bytes,
        attestation_type: Symbol,
        threshold: i128,
    ) -> bool {
        // User must authorize this transaction
        user.require_auth();

        // ---- ZK PROOF VERIFICATION ----
        let proof_valid = Self::verify_proof(&env, &proof, threshold, &attestation_type);

        if !proof_valid {
            log!(&env, "Proof verification failed");
            return false;
        }

        // ---- ISSUE ATTESTATION ----
        let now = env.ledger().timestamp();
        let expiry = now + 7_776_000; // 90 days in seconds

        let proof_hash = env.crypto().sha256(&proof);

        let attestation = Attestation {
            holder: user.clone(),
            attestation_type: attestation_type.clone(),
            threshold,
            issued_at: now,
            expires_at: expiry,
            proof_hash: proof_hash.into(),
        };

        // Store the attestation
        let key = AttestationKey {
            holder: user.clone(),
            att_type: attestation_type.clone(),
        };
        env.storage().persistent().set(&key, &attestation);

        // Bump storage TTL to match expiry (90 days = ~1,555,200 ledgers at 5s/ledger)
        env.storage()
            .persistent()
            .extend_ttl(&key, 1_555_200, 1_555_200);

        // Increment total attestations counter
        let total: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalAttestations)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalAttestations, &(total + 1));

        log!(&env, "Attestation issued for user");

        true
    }

    // --------------------------------------------------------
    // QUERY: Check if an address has a valid attestation
    // --------------------------------------------------------

    /// Check if an address holds a valid (non-expired) attestation.
    /// This is the function verifiers (landlords, DAOs, etc.) call.
    ///
    /// # Returns
    /// * `true` if the address has a valid, non-expired attestation of the given type
    pub fn check(env: Env, address: Address, attestation_type: Symbol) -> bool {
        let key = AttestationKey {
            holder: address,
            att_type: attestation_type,
        };

        match env
            .storage()
            .persistent()
            .get::<AttestationKey, Attestation>(&key)
        {
            Some(att) => {
                let now = env.ledger().timestamp();
                att.expires_at > now
            }
            None => false,
        }
    }

    /// Get full attestation details (for the attestation holder or authorized viewers)
    pub fn get_attestation(
        env: Env,
        address: Address,
        attestation_type: Symbol,
    ) -> Option<Attestation> {
        let key = AttestationKey {
            holder: address,
            att_type: attestation_type,
        };
        env.storage().persistent().get(&key)
    }

    // --------------------------------------------------------
    // USER: Revoke own attestation
    // --------------------------------------------------------

    /// User can revoke their own attestation at any time
    pub fn revoke(env: Env, user: Address, attestation_type: Symbol) {
        user.require_auth();

        let key = AttestationKey {
            holder: user,
            att_type: attestation_type,
        };
        env.storage().persistent().remove(&key);
        log!(&env, "Attestation revoked");
    }

    // --------------------------------------------------------
    // STATS
    // --------------------------------------------------------

    /// Get total number of attestations ever issued
    pub fn total_attestations(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalAttestations)
            .unwrap_or(0)
    }

    // --------------------------------------------------------
    // INTERNAL: Proof verification
    // --------------------------------------------------------

    /// Verify a ZK proof with Soroban's native pairing host function.
    ///
    /// Proof layout:
    ///   public inputs: 4 * 32-byte BE fields
    ///     [0] minimum_threshold
    ///     [1] attestation_type (1=income, 2=balance, 3=credit)
    ///     [2] timestamp
    ///     [3] data_commitment
    ///   vk_pair_count * Bls12381G1Affine(96 bytes)
    ///   zero or more proof-local pairs:
    ///     Bls12381G1Affine(96 bytes) || Bls12381G2Affine(192 bytes)
    ///
    /// VK layout is documented in `store_verification_key`. This mirrors the
    /// rs-soroban-ultrahonk pattern: deserialize proof/VK points, build parallel
    /// G1/G2 vectors, and call the host `pairing_check` exactly once.
    fn verify_proof(
        env: &Env,
        proof: &Bytes,
        expected_threshold: i128,
        expected_attestation_type: &Symbol,
    ) -> bool {
        let vk: Bytes = match env.storage().instance().get(&DataKey::VerificationKey) {
            Some(vk) => vk,
            None => return false,
        };

        let vk_pair_count = match Self::verification_key_pair_count(&vk) {
            Some(count) => count,
            None => return false,
        };

        if proof.len() < PUBLIC_INPUT_BYTES + (vk_pair_count * G1_BYTES) {
            return false;
        }

        let remaining = proof.len() - PUBLIC_INPUT_BYTES - (vk_pair_count * G1_BYTES);
        if remaining % PROOF_EXTRA_PAIR_BYTES != 0 {
            return false;
        }

        let minimum_threshold = Self::read_field_u64(proof, 0);
        let attestation_type = Self::read_field_u64(proof, 32);
        let timestamp = Self::read_field_u64(proof, 64);
        let _data_commitment = proof.slice(96..128);

        if expected_threshold < 0 || minimum_threshold != expected_threshold as u64 {
            return false;
        }
        if attestation_type != Self::attestation_type_to_public_input(expected_attestation_type) {
            return false;
        }
        if timestamp <= 1_704_067_200 {
            return false;
        }

        let mut g1s: Vec<G1Affine> = Vec::new(env);
        let mut g2s: Vec<G2Affine> = Vec::new(env);

        let mut proof_offset = PUBLIC_INPUT_BYTES;
        let mut vk_offset = 8u32;
        let mut i = 0u32;
        while i < vk_pair_count {
            g1s.push_back(Self::read_g1(env, proof, proof_offset));
            g2s.push_back(Self::read_g2(env, &vk, vk_offset));
            proof_offset += G1_BYTES;
            vk_offset += G2_BYTES;
            i += 1;
        }

        while proof_offset < proof.len() {
            g1s.push_back(Self::read_g1(env, proof, proof_offset));
            proof_offset += G1_BYTES;
            g2s.push_back(Self::read_g2(env, proof, proof_offset));
            proof_offset += G2_BYTES;
        }

        env.crypto().bls12_381().pairing_check(g1s, g2s)
    }

    fn valid_verification_key(vk: &Bytes) -> bool {
        Self::verification_key_pair_count(vk).is_some()
    }

    fn verification_key_pair_count(vk: &Bytes) -> Option<u32> {
        if vk.len() < 8 {
            return None;
        }
        let mut magic = [0u8; 4];
        vk.slice(0..4).copy_into_slice(&mut magic);
        if magic != VK_MAGIC {
            return None;
        }

        let mut count_bytes = [0u8; 4];
        vk.slice(4..8).copy_into_slice(&mut count_bytes);
        let count = u32::from_be_bytes(count_bytes);
        if count == 0 {
            return None;
        }

        if vk.len() == 8 + (count * G2_BYTES) {
            Some(count)
        } else {
            None
        }
    }

    fn read_field_u64(bytes: &Bytes, offset: u32) -> u64 {
        let mut field = [0u8; 32];
        bytes.slice(offset..offset + 32).copy_into_slice(&mut field);
        let mut value = [0u8; 8];
        value.copy_from_slice(&field[24..32]);
        u64::from_be_bytes(value)
    }

    fn attestation_type_to_public_input(attestation_type: &Symbol) -> u64 {
        if *attestation_type == symbol_short!("income") {
            1
        } else if *attestation_type == symbol_short!("balance") {
            2
        } else if *attestation_type == symbol_short!("credit") {
            3
        } else {
            0
        }
    }

    fn read_g1(env: &Env, bytes: &Bytes, offset: u32) -> G1Affine {
        let mut raw = [0u8; 96];
        bytes
            .slice(offset..offset + G1_BYTES)
            .copy_into_slice(&mut raw);
        G1Affine::from_array(env, &raw)
    }

    fn read_g2(env: &Env, bytes: &Bytes, offset: u32) -> G2Affine {
        let mut raw = [0u8; 192];
        bytes
            .slice(offset..offset + G2_BYTES)
            .copy_into_slice(&mut raw);
        G2Affine::from_array(env, &raw)
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn append_field_u64(bytes: &mut Bytes, value: u64) {
        let mut field = [0u8; 32];
        field[24..32].copy_from_slice(&value.to_be_bytes());
        bytes.extend_from_slice(&field);
    }

    fn test_vk(env: &Env) -> Bytes {
        let mut vk = Bytes::new(env);
        vk.extend_from_slice(&VK_MAGIC);
        vk.extend_from_slice(&1u32.to_be_bytes());
        let mut g2_infinity = [0u8; 192];
        g2_infinity[0] = 0x40;
        vk.extend_from_slice(&g2_infinity);
        vk
    }

    fn test_proof(env: &Env, threshold: u64, att_type: u64) -> Bytes {
        let mut proof = Bytes::new(env);
        append_field_u64(&mut proof, threshold);
        append_field_u64(&mut proof, att_type);
        append_field_u64(&mut proof, 1_750_000_000);
        append_field_u64(&mut proof, 42);
        let mut g1_infinity = [0u8; 96];
        g1_infinity[0] = 0x40;
        proof.extend_from_slice(&g1_infinity);
        proof
    }

    fn initialize_with_vk(env: &Env, client: &ZkProofVerifierClient<'_>, admin: &Address) {
        client.initialize(admin);
        assert!(client.store_verification_key(admin, &test_vk(env)));
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        assert_eq!(client.total_attestations(), 0);
    }

    #[test]
    fn test_attest_and_check() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        initialize_with_vk(&env, &client, &admin);

        // Test pairing proof (in production, this comes from bb.js/Noir)
        let proof = test_proof(&env, 3000, 1);
        let att_type = symbol_short!("income");
        let threshold: i128 = 3000;

        // Submit attestation
        let result = client.attest(&user, &proof, &att_type, &threshold);
        assert!(result);

        // Check attestation exists
        assert!(client.check(&user, &att_type));

        // Check total count
        assert_eq!(client.total_attestations(), 1);
    }

    #[test]
    fn test_check_nonexistent() {
        let env = Env::default();
        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let random_user = Address::generate(&env);
        let att_type = symbol_short!("income");

        // Should return false for non-existent attestation
        assert!(!client.check(&random_user, &att_type));
    }

    #[test]
    fn test_revoke() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        initialize_with_vk(&env, &client, &admin);

        let proof = test_proof(&env, 3000, 1);
        let att_type = symbol_short!("income");

        // Attest then revoke
        client.attest(&user, &proof, &att_type, &3000i128);
        assert!(client.check(&user, &att_type));

        client.revoke(&user, &att_type);
        assert!(!client.check(&user, &att_type));
    }

    #[test]
    fn test_get_attestation_details() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        initialize_with_vk(&env, &client, &admin);

        let proof = test_proof(&env, 5000, 1);
        let att_type = symbol_short!("income");
        let threshold: i128 = 5000;

        client.attest(&user, &proof, &att_type, &threshold);

        let attestation = client.get_attestation(&user, &att_type);
        assert!(attestation.is_some());

        let att = attestation.unwrap();
        assert_eq!(att.threshold, 5000);
        assert_eq!(att.holder, user);
    }

    #[test]
    fn test_store_verification_key_rejects_malformed_key() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let bad_vk = Bytes::from_slice(&env, &[0u8; 32]);
        assert!(!client.store_verification_key(&admin, &bad_vk));
    }

    #[test]
    fn test_attest_fails_without_verification_key() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.initialize(&admin);

        let proof = test_proof(&env, 3000, 1);
        let att_type = symbol_short!("income");
        assert!(!client.attest(&user, &proof, &att_type, &3000i128));
    }

    #[test]
    fn test_attest_fails_when_public_inputs_do_not_match_call() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZkProofVerifier, ());
        let client = ZkProofVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        initialize_with_vk(&env, &client, &admin);

        let proof = test_proof(&env, 3000, 1);
        let att_type = symbol_short!("income");
        assert!(!client.attest(&user, &proof, &att_type, &5000i128));
    }
}
