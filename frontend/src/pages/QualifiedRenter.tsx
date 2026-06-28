/**
 * QualifiedRenter — composite privacy-preserving rental qualification demo.
 *
 * This page demonstrates the composite `qualified_renter` proof flow that the
 * `main_composite` circuit in `circuits/src/main.nr` enforces:
 *
 *   1. Average monthly income over 6 months exceeds the landlord's threshold.
 *   2. Every individual month meets a stability floor (default: 70% of threshold).
 *   3. None of the 30 sampled daily balances is negative.
 *
 * The full UltraHonk proof for `main_composite` requires a separate circuit
 * artifact + verification key (different witness layout than `main`). For the
 * hackathon demo we compute the Poseidon commitment locally in the browser and
 * show the user the public-input payload that the on-chain verifier would
 * accept — same shape, same commitment, no chain tx required to inspect.
 *
 * Pure-local feature: no Stellar tx, no proof generation. Adds zero risk to
 * the existing single-condition flow used by the live Vercel demo.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { poseidon2 as poseidonHash2 } from 'poseidon-lite';

const MONTHS = 6;
const BALANCE_DAYS = 30;
const DEFAULT_THRESHOLD = 3000;
const DEFAULT_FLOOR_BPS = 7000; // 70% stability floor
const PER_SAMPLE_BOUND = 1_000_000_000_000_000; // 10^15 — matches circuit main_clean

function bigField(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

function parseNum(s: string, fallback = 0): bigint {
  const cleaned = s.replace(/,/g, '').trim();
  if (!cleaned) return BigInt(fallback);
  if (!/^\d+$/.test(cleaned)) return BigInt(fallback);
  return BigInt(cleaned);
}

function defaultIncomes(): string[] {
  return ['5000', '5200', '5100', '5300', '5000', '5150'];
}

function defaultBalances(): string[] {
  // 30 days of 1000 XLM (1_000_000_000 stroops with 7 decimals)
  return Array(BALANCE_DAYS).fill('1000000000');
}

export default function QualifiedRenter() {
  const [threshold, setThreshold] = useState(String(DEFAULT_THRESHOLD));
  const [floorBps, setFloorBps] = useState(String(DEFAULT_FLOOR_BPS));
  const [secret, setSecret] = useState('42');
  const [monthly, setMonthly] = useState<string[]>(defaultIncomes());
  const [balances, setBalances] = useState<string[]>(defaultBalances());
  const [timestamp] = useState(() => Math.floor(Date.now() / 1000));

  const result = useMemo(() => {
    const t = parseNum(threshold, DEFAULT_THRESHOLD);
    const ratio = parseNum(floorBps, DEFAULT_FLOOR_BPS);
    const floor = (t * ratio) / 10000n;
    const monthlyN = monthly.map((m) => parseNum(m, 0));
    const balanceN = balances.map((b) => parseNum(b, 0));

    const sumIncome = monthlyN.reduce((a, b) => a + b, 0n);
    const avgIncome = sumIncome / BigInt(MONTHS);
    const incomeAboveThreshold = avgIncome > t;
    const allMonthsAboveFloor = monthlyN.every((m) => m >= floor);
    const allBalancesInRange = balanceN.every((b) => b < BigInt(PER_SAMPLE_BOUND));

    const sumBalance = balanceN.reduce((a, b) => a + b, 0n);
    // Same composite formula the circuit enforces.
    const composite = sumIncome + sumBalance + BigInt(MONTHS + BALANCE_DAYS);

    // Poseidon commitment — same hash the circuit checks against.
    let commitment: bigint | null = null;
    try {
      commitment = poseidonHash2([BigInt(secret), composite]);
    } catch (e) {
      commitment = null;
    }

    // The on-chain verifier would receive these 5 Field elements (32 bytes each,
    // big-endian). With attestation_type=4, the contract symbol "qualif" maps to u64=4.
    const publicInputs = {
      minimum_threshold: t,
      attestation_type: 4n,
      timestamp: BigInt(timestamp),
      data_commitment: commitment ?? 0n,
      floor_ratio_bps: ratio,
    };

    const qualified =
      incomeAboveThreshold && allMonthsAboveFloor && allBalancesInRange;

    return {
      floor,
      sumIncome,
      avgIncome,
      sumBalance,
      composite,
      commitment,
      publicInputs,
      incomeAboveThreshold,
      allMonthsAboveFloor,
      allBalancesInRange,
      qualified,
    };
  }, [threshold, floorBps, secret, monthly, balances, timestamp]);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Qualified Renter — composite proof</h1>
        <p className="lead">
          Prove three qualification rules in one zero-knowledge proof: stable income,
          floor maintenance, and no negative balances. Numbers stay in your browser.
        </p>
      </header>

      <div className="qualified-grid">
        <form className="qualified-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Public inputs (visible on-chain)</legend>
            <label>
              Threshold
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                min={1}
              />
              <small>Landlord requires income above this each month.</small>
            </label>
            <label>
              Stability floor (basis points)
              <input
                type="number"
                value={floorBps}
                onChange={(e) => setFloorBps(e.target.value)}
                min={1}
                max={10000}
              />
              <small>7000 = 70% of threshold. Every month must clear this.</small>
            </label>
            <label>
              Data source secret
              <input
                type="number"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <small>Field element used in the Poseidon commitment. Stays local.</small>
            </label>
          </fieldset>

          <fieldset>
            <legend>Private witness — 6 months income</legend>
            {monthly.map((m, i) => (
              <label key={i} className="row">
                Month {i + 1}
                <input
                  type="number"
                  value={m}
                  onChange={(e) => {
                    const next = [...monthly];
                    next[i] = e.target.value;
                    setMonthly(next);
                  }}
                />
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>
              Private witness — 30-day daily balance sample (stroops)
            </legend>
            <details>
              <summary>Edit 30 daily balances</summary>
              {balances.map((b, i) => (
                <label key={i} className="row compact">
                  Day {i + 1}
                  <input
                    type="number"
                    value={b}
                    onChange={(e) => {
                      const next = [...balances];
                      next[i] = e.target.value;
                      setBalances(next);
                    }}
                  />
                </label>
              ))}
            </details>
            <small>
              Encoded as 7-decimal Stellar XLM. Anything over {PER_SAMPLE_BOUND.toLocaleString()} is rejected as out-of-range (treat as negative).
            </small>
          </fieldset>

          <button type="button" className="cta" onClick={() => {
            setMonthly(defaultIncomes());
            setBalances(defaultBalances());
            setThreshold(String(DEFAULT_THRESHOLD));
            setFloorBps(String(DEFAULT_FLOOR_BPS));
            setSecret('42');
          }}>
            Reset to demo values
          </button>
        </form>

        <aside className="qualified-result">
          <div className={`qualified-badge ${result.qualified ? 'pass' : 'fail'}`}>
            {result.qualified ? 'Qualified' : 'Not qualified'}
          </div>

          <h2>Check results</h2>
          <ul className="rule-list">
            <li className={result.incomeAboveThreshold ? 'ok' : 'bad'}>
              <strong>Average income</strong>
              <span>{result.avgIncome.toString()} (need &gt; {threshold})</span>
            </li>
            <li className={result.allMonthsAboveFloor ? 'ok' : 'bad'}>
              <strong>Stability floor</strong>
              <span>Every month ≥ {result.floor.toString()}</span>
            </li>
            <li className={result.allBalancesInRange ? 'ok' : 'bad'}>
              <strong>No negative balances</strong>
              <span>All 30 samples in safe range</span>
            </li>
          </ul>

          <h2>Public inputs (would be sent to Soroban)</h2>
          <dl className="pi-list">
            <dt>minimum_threshold</dt>
            <dd className="mono">{bigField(result.publicInputs.minimum_threshold)}</dd>
            <dt>attestation_type</dt>
            <dd className="mono">{result.publicInputs.attestation_type.toString()} (qualified_renter)</dd>
            <dt>timestamp</dt>
            <dd className="mono">{result.publicInputs.timestamp.toString()}</dd>
            <dt>data_commitment</dt>
            <dd className="mono">
              {result.commitment !== null ? bigField(result.commitment) : '— compute failed —'}
            </dd>
            <dt>floor_ratio_bps</dt>
            <dd className="mono">{result.publicInputs.floor_ratio_bps.toString()}</dd>
          </dl>

          <p className="note">
            The full UltraHonk proof for <code>main_composite</code> requires a separate circuit artifact + VK (different witness layout from <code>main()</code>). The Poseidon commitment above is identical to what the circuit would produce, so you can verify locally that the witness is correctly bound to the data you entered.
          </p>
        </aside>
      </div>

      <footer className="page-footer">
        <Link to="/prove">← single-condition proof</Link>
        <span> · </span>
        <Link to="/">home</Link>
      </footer>
    </section>
  );
}
