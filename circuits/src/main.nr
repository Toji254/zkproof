// zkProof — Income Range Proof Circuit
// 
// This circuit proves that a user's monthly income exceeds a given threshold
// WITHOUT revealing the actual income amount. It also verifies a Poseidon
// commitment to bind the income data to a trusted source, preventing fabrication.
//
// Private inputs (witness — never revealed to anyone):
//   - monthly_income: the user's actual monthly income
//   - data_source_secret: a secret tied to the data source (bank API key hash, etc.)
//
// Public inputs (visible to the on-chain verifier):
//   - minimum_threshold: the minimum income required (e.g., 3000 for $3,000/month)
//   - attestation_type: type of attestation (1=income, 2=balance, 3=credit_score)
//   - timestamp: when the proof was generated (unix timestamp)
//   - data_commitment: Poseidon hash binding the income to its source

use poseidon::poseidon::bn254;

fn main(
    // ===== PRIVATE INPUTS (the "witness" — never revealed) =====
    monthly_income: Field,
    data_source_secret: Field,

    // ===== PUBLIC INPUTS (visible to Soroban verifier) =====
    minimum_threshold: pub Field,
    attestation_type: pub Field,
    timestamp: pub Field,
    data_commitment: pub Field
) {
    // -------------------------------------------------------
    // CONSTRAINT 1: Income exceeds the minimum threshold
    // -------------------------------------------------------
    // We convert to u64 for safe comparison (Noir fields are prime field elements)
    // This is the core "load-bearing" ZK assertion — without this,
    // the verifier would need to see the actual income.
    let income_val = monthly_income as u64;
    let threshold_val = minimum_threshold as u64;
    
    assert(income_val > threshold_val, "Income must exceed the minimum threshold");

    // -------------------------------------------------------
    // CONSTRAINT 2: Income is within a reasonable range
    // -------------------------------------------------------
    // Prevents overflow attacks and ensures the value is sensible
    // Max monthly income capped at $10,000,000 (10M) — covers any real scenario
    assert(income_val < 10_000_000, "Income must be within reasonable range");

    // -------------------------------------------------------
    // CONSTRAINT 3: Threshold is positive and reasonable
    // -------------------------------------------------------
    assert(threshold_val > 0, "Threshold must be positive");

    // -------------------------------------------------------
    // CONSTRAINT 4: Valid attestation type
    // -------------------------------------------------------
    let att_type = attestation_type as u64;
    assert(att_type >= 1, "Attestation type must be >= 1");
    assert(att_type <= 3, "Attestation type must be <= 3");

    // -------------------------------------------------------
    // CONSTRAINT 5: Timestamp is reasonable (after 2024)
    // -------------------------------------------------------
    let ts = timestamp as u64;
    assert(ts > 1704067200, "Timestamp must be after Jan 1 2024");

    // -------------------------------------------------------
    // CONSTRAINT 6: Data commitment verification (Poseidon hash)
    // -------------------------------------------------------
    // This proves the income data wasn't fabricated — it must match
    // a commitment created from the data source secret and the income.
    // The commitment is: Poseidon(data_source_secret, monthly_income)
    // 
    // In practice, this commitment would be created by a trusted data
    // provider (bank API, payroll service, etc.) and shared with the user.
    let computed_commitment = bn254::hash_2([
        data_source_secret,
        monthly_income
    ]);
    assert(computed_commitment == data_commitment, "Data commitment mismatch — income data may be fabricated");
}

// -------------------------------------------------------
// TEST: Verify the circuit works with known values
// -------------------------------------------------------
#[test]
fn test_valid_income_proof() {
    // A user with $5,000/month income proving they exceed $3,000/month
    let income = 5000;
    let secret = 42;
    let threshold = 3000;
    let att_type = 1; // income
    let ts = 1750000000; // ~June 2025

    // Compute the expected commitment
    let commitment = bn254::hash_2([secret, income]);

    // This should pass — income (5000) > threshold (3000)
    main(income, secret, threshold, att_type, ts, commitment);
}

#[test(should_fail_with = "Income must exceed the minimum threshold")]
fn test_insufficient_income() {
    let income = 2000;
    let secret = 42;
    let threshold = 3000;
    let att_type = 1;
    let ts = 1750000000;

    let commitment = bn254::hash_2([secret, income]);

    // This should FAIL — income (2000) < threshold (3000)
    main(income, secret, threshold, att_type, ts, commitment);
}

#[test(should_fail_with = "Data commitment mismatch")]
fn test_fabricated_income() {
    let real_income = 2000; // actual income
    let fake_income = 5000; // trying to fake it
    let secret = 42;
    let threshold = 3000;
    let att_type = 1;
    let ts = 1750000000;

    // Commitment is for real_income, but we pass fake_income
    let commitment = bn254::hash_2([secret, real_income]);

    // This should FAIL — commitment doesn't match fake income
    main(fake_income, secret, threshold, att_type, ts, commitment);
}
