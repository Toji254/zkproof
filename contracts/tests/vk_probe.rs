use soroban_sdk::{Bytes, Env};
use ultrahonk_soroban_verifier::UltraHonkVerifier;

#[test]
fn verifier_accepts_1760_raw_vk_and_rejects_1764_variant() {
    let env = Env::default();

    let valid_vk = include_bytes!("../testdata/valid_vk.bin");
    let valid_bytes = Bytes::from_slice(&env, valid_vk);
    assert!(UltraHonkVerifier::new(&env, &valid_bytes).is_ok());

    let mut with_trailing_bytes = valid_vk.to_vec();
    with_trailing_bytes.extend_from_slice(&[0xde, 0xad, 0xbe, 0xef]);
    let invalid_bytes = Bytes::from_slice(&env, &with_trailing_bytes);
    assert!(UltraHonkVerifier::new(&env, &invalid_bytes).is_err());
}
