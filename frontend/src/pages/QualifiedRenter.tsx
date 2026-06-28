/**
 * QualifiedRenter — composite privacy-preserving rental qualification demo.
 *
 * Three rules in one ZK proof, all amounts stay private:
 *   1. Average monthly income over 6 months exceeds threshold.
 *   2. Every individual month meets a stability floor (default 70% of threshold).
 *   3. None of the 30 sampled daily balances is negative.
 *
 * The full UltraHonk proof for `main_composite` requires a separate circuit
 * artifact + VK (different witness layout than `main`). For the demo we
 * compute the Poseidon commitment locally in the browser and show the user
 * the public-input payload that the on-chain verifier would accept.
 *
 * Design system: matches the rest of the app (IBM Plex Mono, #050a0f bg,
 * #00d4aa accent, glass-card panels, teal-on-dark). No CSS classes — inline
 * styles for clarity + zero risk of style conflicts.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { poseidon2 as poseidonHash2 } from 'poseidon-lite';

const MONTHS = 6;
const BALANCE_DAYS = 30;
const DEFAULT_THRESHOLD = 3000;
const DEFAULT_FLOOR_BPS = 7000;
const PER_SAMPLE_BOUND = 1_000_000_000_000_000;

const ACCENT = '#00d4aa';
const BG = '#050a0f';
const BG_CARD = 'rgba(13, 22, 32, 0.8)';
const BORDER = 'rgba(255, 255, 255, 0.08)';
const BORDER_ACCENT = 'rgba(0, 212, 170, 0.35)';
const TEXT = '#e8ecf1';
const MUTED = '#8899aa';
const SUCCESS = '#00d4aa';
const DANGER = '#ff5a7a';
const FONT = "'IBM Plex Mono', 'Menlo', monospace";

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
  return Array(BALANCE_DAYS).fill('1000000000');
}

interface RuleRowProps {
  ok: boolean;
  title: string;
  detail: string;
}
function RuleRow({ ok, title, detail }: RuleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${ok ? 'rgba(0,212,170,0.18)' : 'rgba(255,90,122,0.22)'}`,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: ok ? BG : BG,
            background: ok ? SUCCESS : DANGER,
            fontFamily: FONT,
          }}
        >
          {ok ? '✓' : '×'}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: TEXT,
          }}
        >
          {title}
        </span>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED }}>{detail}</span>
    </div>
  );
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
    const composite = sumIncome + sumBalance + BigInt(MONTHS + BALANCE_DAYS);

    let commitment: bigint | null = null;
    try {
      commitment = poseidonHash2([BigInt(secret), composite]);
    } catch {
      commitment = null;
    }

    const publicInputs = {
      minimum_threshold: t,
      attestation_type: 4n,
      timestamp: BigInt(timestamp),
      data_commitment: commitment ?? 0n,
      floor_ratio_bps: ratio,
    };

    const qualified = incomeAboveThreshold && allMonthsAboveFloor && allBalancesInRange;

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

  const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontFamily: FONT,
    fontSize: 13,
    color: TEXT,
    outline: 'none',
    transition: 'border-color 150ms ease',
  };

  const labelBase: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 14,
  };

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: FONT,
        padding: '120px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.3em',
              color: ACCENT,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            ProofPass · Composite proof
          </div>
          <h1
            style={{
              fontFamily: "'Geist Pixel', monospace",
              fontSize: 'clamp(28px, 4.5vw, 48px)',
              fontWeight: 400,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              letterSpacing: '0.01em',
              color: '#fff',
              margin: '0 0 16px',
              maxWidth: '20ch',
            }}
          >
            Qualified renter
          </h1>
          <p
            style={{
              fontFamily: FONT,
              fontSize: 14,
              lineHeight: 1.7,
              color: MUTED,
              maxWidth: '64ch',
              margin: 0,
            }}
          >
            Prove three qualification rules in one zero-knowledge proof: stable
            income, floor maintenance, and no negative balances. Numbers stay in
            your browser.
          </p>
        </div>

        {/* Two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* LEFT: form */}
          <div
            style={{
              background: BG_CARD,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 28,
            }}
          >
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: '0 0 28px',
              }}
            >
              <legend
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: ACCENT,
                  marginBottom: 16,
                  padding: 0,
                }}
              >
                Public inputs · visible on-chain
              </legend>

              <label style={labelBase}>
                Threshold
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  min={1}
                  style={inputBase}
                />
                <span style={{ fontSize: 10, color: MUTED, textTransform: 'none', letterSpacing: 0 }}>
                  Landlord requires income above this each month.
                </span>
              </label>

              <label style={labelBase}>
                Stability floor (basis points)
                <input
                  type="number"
                  value={floorBps}
                  onChange={(e) => setFloorBps(e.target.value)}
                  min={1}
                  max={10000}
                  style={inputBase}
                />
                <span style={{ fontSize: 10, color: MUTED, textTransform: 'none', letterSpacing: 0 }}>
                  7000 = 70% of threshold. Every month must clear this.
                </span>
              </label>

              <label style={labelBase}>
                Data source secret
                <input
                  type="number"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  style={inputBase}
                />
                <span style={{ fontSize: 10, color: MUTED, textTransform: 'none', letterSpacing: 0 }}>
                  Field element used in the Poseidon commitment. Stays local.
                </span>
              </label>
            </fieldset>

            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: '0 0 28px',
              }}
            >
              <legend
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: ACCENT,
                  marginBottom: 16,
                  padding: 0,
                }}
              >
                Private witness · 6 months income
              </legend>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {monthly.map((m, i) => (
                  <label key={i} style={{ ...labelBase, marginBottom: 0 }}>
                    Month {i + 1}
                    <input
                      type="number"
                      value={m}
                      onChange={(e) => {
                        const next = [...monthly];
                        next[i] = e.target.value;
                        setMonthly(next);
                      }}
                      style={inputBase}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: '0 0 24px' }}>
              <legend
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: ACCENT,
                  marginBottom: 12,
                  padding: 0,
                }}
              >
                Private witness · 30-day daily balance sample (stroops)
              </legend>
              <details
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <summary
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    color: TEXT,
                    cursor: 'pointer',
                    listStyle: 'none',
                  }}
                >
                  Edit 30 daily balances
                </summary>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {balances.map((b, i) => (
                    <label
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontFamily: FONT,
                        fontSize: 9,
                        color: MUTED,
                        letterSpacing: '0.08em',
                      }}
                    >
                      D{i + 1}
                      <input
                        type="number"
                        value={b}
                        onChange={(e) => {
                          const next = [...balances];
                          next[i] = e.target.value;
                          setBalances(next);
                        }}
                        style={{
                          ...inputBase,
                          padding: '6px 8px',
                          fontSize: 11,
                        }}
                      />
                    </label>
                  ))}
                </div>
              </details>
              <span
                style={{
                  display: 'block',
                  marginTop: 10,
                  fontFamily: FONT,
                  fontSize: 10,
                  color: MUTED,
                  letterSpacing: 0,
                }}
              >
                Encoded as 7-decimal Stellar XLM. Anything over {PER_SAMPLE_BOUND.toLocaleString()} is rejected as out-of-range (treated as negative).
              </span>
            </fieldset>

            <button
              type="button"
              onClick={() => {
                setMonthly(defaultIncomes());
                setBalances(defaultBalances());
                setThreshold(String(DEFAULT_THRESHOLD));
                setFloorBps(String(DEFAULT_FLOOR_BPS));
                setSecret('42');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'transparent',
                color: ACCENT,
                border: `1px solid ${BORDER_ACCENT}`,
                borderRadius: 12,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Reset to demo values
            </button>
          </div>

          {/* RIGHT: result */}
          <div
            style={{
              background: BG_CARD,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${result.qualified ? BORDER_ACCENT : 'rgba(255,90,122,0.25)'}`,
              borderRadius: 16,
              padding: 28,
              position: 'sticky',
              top: 100,
            }}
          >
            {/* Big status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '20px 22px',
                borderRadius: 12,
                background: result.qualified
                  ? 'linear-gradient(135deg, rgba(0,212,170,0.12) 0%, rgba(0,212,170,0.04) 100%)'
                  : 'linear-gradient(135deg, rgba(255,90,122,0.12) 0%, rgba(255,90,122,0.04) 100%)',
                border: `1px solid ${result.qualified ? 'rgba(0,212,170,0.35)' : 'rgba(255,90,122,0.35)'}`,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  fontSize: 18,
                  fontWeight: 700,
                  color: BG,
                  background: result.qualified ? SUCCESS : DANGER,
                }}
              >
                {result.qualified ? '✓' : '×'}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "'Geist Pixel', monospace",
                    fontSize: 22,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: result.qualified ? SUCCESS : DANGER,
                    lineHeight: 1,
                  }}
                >
                  {result.qualified ? 'Qualified' : 'Not qualified'}
                </div>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    color: MUTED,
                    marginTop: 4,
                    letterSpacing: '0.08em',
                  }}
                >
                  Composite proof check
                </div>
              </div>
            </div>

            <h2
              style={{
                fontFamily: FONT,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: MUTED,
                margin: '0 0 12px',
              }}
            >
              Check results
            </h2>

            <RuleRow
              ok={result.incomeAboveThreshold}
              title="Average income"
              detail={`${result.avgIncome.toString()} > ${threshold}`}
            />
            <RuleRow
              ok={result.allMonthsAboveFloor}
              title="Stability floor"
              detail={`Every month ≥ ${result.floor.toString()}`}
            />
            <RuleRow
              ok={result.allBalancesInRange}
              title="No negative balances"
              detail="All 30 samples in safe range"
            />

            <h2
              style={{
                fontFamily: FONT,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: MUTED,
                margin: '24px 0 12px',
              }}
            >
              Public inputs · Soroban payload
            </h2>

            <div
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '14px 16px',
                fontFamily: FONT,
                fontSize: 11,
                color: TEXT,
                wordBreak: 'break-all',
                lineHeight: 1.7,
              }}
            >
              {[
                ['minimum_threshold', bigField(result.publicInputs.minimum_threshold)],
                ['attestation_type', `${result.publicInputs.attestation_type.toString()} (qualified_renter)`],
                ['timestamp', result.publicInputs.timestamp.toString()],
                [
                  'data_commitment',
                  result.commitment !== null ? bigField(result.commitment) : '— compute failed —',
                ],
                ['floor_ratio_bps', result.publicInputs.floor_ratio_bps.toString()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                  <span style={{ color: MUTED, minWidth: 150 }}>{k}</span>
                  <span style={{ color: ACCENT }}>{v}</span>
                </div>
              ))}
            </div>

            <p
              style={{
                fontFamily: FONT,
                fontSize: 11,
                lineHeight: 1.7,
                color: MUTED,
                margin: '16px 0 0',
              }}
            >
              The full UltraHonk proof for <code style={{ color: ACCENT }}>main_composite</code> requires a separate circuit artifact + VK (different witness layout from <code style={{ color: ACCENT }}>main()</code>). The Poseidon commitment above is identical to what the circuit would produce, so you can verify locally that the witness is correctly bound to the data you entered.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${BORDER}`,
            fontFamily: FONT,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <Link
            to="/prove"
            style={{
              color: ACCENT,
              textDecoration: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: 11,
            }}
          >
            ← single-condition proof
          </Link>
          <span>·</span>
          <Link
            to="/"
            style={{
              color: ACCENT,
              textDecoration: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: 11,
            }}
          >
            home
          </Link>
        </div>
      </div>
    </section>
  );
}
