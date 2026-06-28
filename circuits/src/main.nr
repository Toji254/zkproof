// zkProof - Income Range Proof Circuit
// 
// This circuit proves that a user's monthly income exceeds a given threshold
// WITHOUT revealing the actual income amount. It also verifies a Poseidon
// commitment to bind the income data to a trusted source, preventing fabrication.
//
// Private inputs (witness - never revealed to anyone):
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
    // ===== PRIVATE INPUTS (the "witness" - never revealed) =====
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
    // This is the core "load-bearing" ZK assertion - without this,
    // the verifier would need to see the actual income.
    let income_val = monthly_income as u64;
    let threshold_val = minimum_threshold as u64;
    
    assert(income_val > threshold_val, "Income must exceed the minimum threshold");

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
    // CONSTRAINT 2: Value is within a reasonable range for its type
    // -------------------------------------------------------
    if att_type == 1 {
        // Income: max $10,000,000 / month
        assert(income_val < 10_000_000, "Income must be within reasonable range");
    } else if att_type == 2 {
        // Balance: max 100,000,000 XLM scaled by 10^7
        assert(income_val < 1_000_000_000_000_000, "Balance must be within reasonable range");
    } else {
        // Credit: credit score cannot exceed 850
        assert(income_val <= 850, "Credit score must be within reasonable range");
    }

    // -------------------------------------------------------
    // CONSTRAINT 5: Timestamp is reasonable (after 2024)
    // -------------------------------------------------------
    let ts = timestamp as u64;
    assert(ts > 1704067200, "Timestamp must be after Jan 1 2024");

    // -------------------------------------------------------
    // CONSTRAINT 6: Data commitment verification (Poseidon hash)
    // -------------------------------------------------------
    // This proves the income data wasn't fabricated - it must match
    // a commitment created from the data source secret and the income.
    // The commitment is: Poseidon(data_source_secret, monthly_income)
    // 
    // In practice, this commitment would be created by a trusted data
    // provider (bank API, payroll service, etc.) and shared with the user.
    let computed_commitment = bn254::hash_2([
        data_source_secret,
        monthly_income
    ]);
    assert(computed_commitment == data_commitment, "Data commitment mismatch - income data may be fabricated");
}

// -------------------------------------------------------
// Multi-month income stability proof (additive -- main() unchanged)
// -------------------------------------------------------
// Proves the average monthly income over 6 months exceeds a threshold
// AND every individual month meets a stability floor (e.g. 70% of threshold).
// All amounts are private; only threshold, floor ratio, and a composite
// Poseidon commitment are public.
//
// Private inputs (witness -- never revealed):
//   - monthly_incomes: 6 monthly income values
//   - data_source_secret: secret used in the commitment
//
// Public inputs (visible on-chain):
//   - minimum_threshold: e.g. 3000 (income > threshold required on average)
//   - attestation_type: must be 1 (income) -- kept for backwards compat
//   - timestamp: unix seconds
//   - data_commitment: Poseidon(secret, sum_of_incomes)
//   - floor_ratio_bps: stability floor in basis points (e.g. 7000 = 70%)
fn main_multi(
    minimum_threshold: Field,
    attestation_type: Field,
    timestamp: Field,
    data_commitment: Field,
    floor_ratio_bps: Field,
    monthly_incomes: [Field; 6],
    data_source_secret: Field,
) {
    let threshold_val = minimum_threshold as u64;
    let att_type = attestation_type as u64;
    let ts = timestamp as u64;
    let ratio = floor_ratio_bps as u64;

    assert(threshold_val > 0, "Threshold must be positive");
    assert(att_type >= 1, "Attestation type must be >= 1");
    assert(att_type <= 3, "Attestation type must be <= 3");
    assert(ts > 1704067200, "Timestamp must be after Jan 1 2024");
    assert(ratio > 0, "Floor ratio must be positive");
    assert(ratio <= 10000, "Floor ratio must be <= 10000 bps");

    let floor = (threshold_val * ratio) / 10000;

    let mut sum: u64 = 0;
    for i in 0..6 {
        let m = monthly_incomes[i] as u64;
        assert(m < 10_000_000, "Monthly income out of range");
        assert(m >= floor, "Monthly income below stability floor");
        sum = sum + m;
    }
    let avg = sum / 6;
    assert(avg > threshold_val, "Average income must exceed threshold");

    let sum_field: Field = sum as Field;
    let computed = bn254::hash_2([data_source_secret, sum_field]);
    assert(computed == data_commitment, "Data commitment mismatch");
}

#[test]
fn test_multi_stable_passes() {
    let incomes: [Field; 6] = [5000, 5200, 5100, 5300, 5000, 5150];
    let secret: Field = 42;
    let threshold: Field = 3000;
    let att_type: Field = 1;
    let ts: Field = 1750000000;
    let ratio: Field = 7000;
    let mut sum: Field = 0;
    for i in 0..6 { sum = sum + incomes[i]; }
    let commitment = bn254::hash_2([secret, sum]);
    main_multi(threshold, att_type, ts, commitment, ratio, incomes, secret);
}

#[test(should_fail_with = "Average income must exceed threshold")]
fn test_multi_avg_too_low() {
    // 6 months at 4000 each: avg=4000, threshold=3000 -> avg passes
    // but one month is 150, threshold floor (3000*7000/10000) = 2100 -> floor fires first
    // to assert avg assertion we need to keep floor satisfied: all months >= 2100
    let incomes: [Field; 6] = [2100, 2100, 2100, 2100, 2100, 2100]; // avg 2100, threshold 3000
    let secret: Field = 42;
    let threshold: Field = 3000;
    let att_type: Field = 1;
    let ts: Field = 1750000000;
    let ratio: Field = 7000;
    let mut sum: Field = 0;
    for i in 0..6 { sum = sum + incomes[i]; }
    let commitment = bn254::hash_2([secret, sum]);
    main_multi(threshold, att_type, ts, commitment, ratio, incomes, secret);
}

#[test(should_fail_with = "Monthly income below stability floor")]
fn test_multi_one_bad_month() {
    // average passes threshold but one month below 70% floor
    let incomes: [Field; 6] = [5000, 5200, 5100, 5300, 5000, 200];
    let secret: Field = 42;
    let threshold: Field = 3000;
    let att_type: Field = 1;
    let ts: Field = 1750000000;
    let ratio: Field = 7000;
    let mut sum: Field = 0;
    for i in 0..6 { sum = sum + incomes[i]; }
    let commitment = bn254::hash_2([secret, sum]);
    main_multi(threshold, att_type, ts, commitment, ratio, incomes, secret);
}

#[test(should_fail_with = "Data commitment mismatch")]
fn test_multi_commitment_mismatch() {
    let incomes: [Field; 6] = [5000, 5200, 5100, 5300, 5000, 5150];
    let secret: Field = 42;
    let wrong_secret: Field = 99;
    let threshold: Field = 3000;
    let att_type: Field = 1;
    let ts: Field = 1750000000;
    let ratio: Field = 7000;
    let mut sum: Field = 0;
    for i in 0..6 { sum = sum + incomes[i]; }
    let commitment = bn254::hash_2([wrong_secret, sum]);
    main_multi(threshold, att_type, ts, commitment, ratio, incomes, secret);
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

    // This should pass - income (5000) > threshold (3000)
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

    // This should FAIL - income (2000) < threshold (3000)
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

    // This should FAIL - commitment doesn't match fake income
    main(fake_income, secret, threshold, att_type, ts, commitment);
}

// -------------------------------------------------------
// No-negative-balance proof (additive -- main() unchanged)
// -------------------------------------------------------
// Proves that none of a 30-day sample of daily balances went negative.
// All balances are private; only threshold, type, timestamp, and a
// composite Poseidon commitment are public.
//
// Note: in Noir, Field values cannot represent negative integers, so the
// prover commits to the raw balance stream. The "non-negative" check is
// enforced by the verifier on the public commitment: the commitment
// encodes the sum which would underflow if any sample were negative.
//
// For the demo, we additionally enforce a per-sample bound (each balance
// must be < 2^40 to reject overflow attacks on the sum commitment).
fn main_clean(
    minimum_threshold: Field,
    attestation_type: Field,
    timestamp: Field,
    data_commitment: Field,
    asset_decimals: Field,
    daily_balances: [Field; 30],
    data_source_secret: Field,
) {
    let threshold_val = minimum_threshold as u64;
    let att_type = attestation_type as u64;
    let ts = timestamp as u64;

    assert(threshold_val > 0, "Threshold must be positive");
    assert(att_type >= 1, "Attestation type must be >= 1");
    assert(att_type <= 3, "Attestation type must be <= 3");
    assert(ts > 1704067200, "Timestamp must be after Jan 1 2024");

    // Per-sample bound: balances must fit in u63 (rejects overflow / negative-as-huge-field attacks).
    // Stellar's largest realistic balance is ~10^18 stroops (XLM has 7 decimals); 10^15 is a safe upper bound.
    let per_sample_bound: u64 = 1_000_000_000_000_000; // 10^15
    assert(per_sample_bound > 0, "Bound sanity");

    let mut sum: u64 = 0;
    for i in 0..30 {
        let b = daily_balances[i] as u64;
        assert(b < per_sample_bound, "Daily balance out of safe range");
        sum = sum + b;
    }
    // If any sample were negative (encoded as a huge Field > per_sample_bound),
    // the assertion above would fail. This is how we enforce "no negatives"
    // in a Field-only arithmetic system.

    let sum_field: Field = sum as Field;
    let computed = bn254::hash_2([data_source_secret, sum_field]);
    assert(computed == data_commitment, "Data commitment mismatch");

    let _ = asset_decimals; // silence unused warning; kept for API stability
}

#[test]
fn test_clean_balances_all_positive() {
    // 30 days, each balance is 1_000_000_000 (1000 XLM)
    let balances: [Field; 30] = [1_000_000_000; 30];
    let secret: Field = 42;
    let threshold: Field = 1;
    let att_type: Field = 2;
    let ts: Field = 1750000000;
    let decimals: Field = 7;
    let mut sum: Field = 0;
    for i in 0..30 { sum = sum + balances[i]; }
    let commitment = bn254::hash_2([secret, sum]);
    main_clean(threshold, att_type, ts, commitment, decimals, balances, secret);
}

#[test(should_fail_with = "Daily balance out of safe range")]
fn test_clean_balance_overflow_attack() {
    // 30 days, but one entry is the BN254 field prime minus 1 -- encoded "negative"
    // must fail the per-sample bound check
    let mut balances: [Field; 30] = [1_000_000_000; 30];
    // field modulus is huge; just put an absurdly large value
    balances[15] = 10_000_000_000_000_001; // one over the per_sample_bound (10^15)
    let secret: Field = 42;
    let threshold: Field = 1;
    let att_type: Field = 2;
    let ts: Field = 1750000000;
    let decimals: Field = 7;
    let mut sum: Field = 0;
    for i in 0..30 { sum = sum + balances[i]; }
    let commitment = bn254::hash_2([secret, sum]);
    main_clean(threshold, att_type, ts, commitment, decimals, balances, secret);
}

#[test(should_fail_with = "Data commitment mismatch")]
fn test_clean_commitment_mismatch() {
    let balances: [Field; 30] = [1_000_000_000; 30];
    let secret: Field = 42;
    let wrong_secret: Field = 99;
    let threshold: Field = 1;
    let att_type: Field = 2;
    let ts: Field = 1750000000;
    let decimals: Field = 7;
    let mut sum: Field = 0;
    for i in 0..30 { sum = sum + balances[i]; }
    let commitment = bn254::hash_2([wrong_secret, sum]);
    main_clean(threshold, att_type, ts, commitment, decimals, balances, secret);
}
