export type AttestationType = 'income' | 'balance' | 'credit';

const BALANCE_DECIMALS = 7;
const BALANCE_SCALE = 10n ** BigInt(BALANCE_DECIMALS);

function normalizeRawInput(raw: string | number | bigint, label: string): string {
  if (typeof raw === 'bigint') return raw.toString();
  const text = String(raw).trim();
  if (!text) {
    throw new Error(`Please enter ${label}.`);
  }
  if (/e/i.test(text)) {
    throw new Error(`${label} must be entered as a normal number, not scientific notation.`);
  }
  return text.replace(/,/g, '');
}

function parseInteger(raw: string | number | bigint, label: string): bigint {
  if (typeof raw === 'bigint') {
    if (raw <= 0n) throw new Error(`${label} must be greater than 0.`);
    return raw;
  }

  const text = normalizeRawInput(raw, label);
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const value = BigInt(text);
  if (value <= 0n) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return value;
}

function parseScaledDecimal(
  raw: string | number | bigint,
  decimals: number,
  label: string,
): bigint {
  const text = normalizeRawInput(raw, label);
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`${label} must be a valid positive number.`);
  }

  const [, wholePart, fractionalPart = ''] = match;
  if (fractionalPart.length > decimals) {
    throw new Error(`${label} supports at most ${decimals} decimal places.`);
  }

  const paddedFraction = fractionalPart.padEnd(decimals, '0');
  const combined = `${wholePart}${paddedFraction}`.replace(/^0+/, '') || '0';
  const value = BigInt(combined);
  if (value <= 0n) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return value;
}

export function normalizeAttestationInput(
  attestationType: AttestationType,
  raw: string | number | bigint,
  label: string,
): bigint {
  if (attestationType === 'balance') {
    return parseScaledDecimal(raw, BALANCE_DECIMALS, label);
  }
  return parseInteger(raw, label);
}

export function formatChainThresholdForDisplay(
  attestationType: AttestationType,
  raw: string | number | bigint,
): string {
  if (attestationType !== 'balance') {
    return String(raw);
  }

  const value = typeof raw === 'bigint' ? raw : BigInt(String(raw));
  const whole = value / BALANCE_SCALE;
  const fraction = value % BALANCE_SCALE;
  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction
    .toString()
    .padStart(BALANCE_DECIMALS, '0')
    .replace(/0+$/, '');
  return `${whole.toString()}.${fractionText}`;
}
