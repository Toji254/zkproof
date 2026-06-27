use soroban_sdk::{testutils::Address as _, symbol_short, Address, Bytes, Env};
use zkproof_contract::{ZkProofVerifier, ZkProofVerifierClient};

fn make_client<'a>(env: &'a Env) -> ZkProofVerifierClient<'a> {
    let admin = Address::generate(env);
    let vk = Bytes::from_slice(env, include_bytes!("../testdata/valid_vk.bin"));
    let contract_id = env.register(ZkProofVerifier, (admin, vk));
    ZkProofVerifierClient::new(env, &contract_id)
}

#[test]
fn browser_generated_proof_verifies_against_fixture_vk() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client(&env);
    let user = Address::generate(&env);

    let public_inputs = std::fs::read("/tmp/zkproof-public-inputs.bin").expect("public inputs fixture");
    let proof = std::fs::read("/tmp/zkproof-proof.bin").expect("proof fixture");

    let ok = client.attest(
        &user,
        &Bytes::from_slice(&env, &public_inputs),
        &Bytes::from_slice(&env, &proof),
        &symbol_short!("income"),
        &3000_i128,
    );

    assert!(ok, "expected browser-generated proof to verify");
    assert!(client.check(&user, &symbol_short!("income")));
}
