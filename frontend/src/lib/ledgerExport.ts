import { jsPDF } from 'jspdf';
import type { LandlordLedgerRecord } from './profile';

export type LedgerExportThemeId = 'noir' | 'emerald' | 'signal';

export interface LedgerExportTheme {
  id: LedgerExportThemeId;
  name: string;
  accent: string;
  glow: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  tagBg: string;
  deco: string;
}

export const LEDGER_EXPORT_THEMES: LedgerExportTheme[] = [
  {
    id: 'noir',
    name: 'Noir Terminal',
    accent: '#00d4aa',
    glow: '#5fffe1',
    panel: '#08111a',
    panelAlt: '#0d1721',
    text: '#ecf4fb',
    muted: '#89a0b6',
    tagBg: 'rgba(0,212,170,0.16)',
    deco: '#153143',
  },
  {
    id: 'emerald',
    name: 'Emerald Certificate',
    accent: '#7cf7c4',
    glow: '#d9fff1',
    panel: '#0f1a18',
    panelAlt: '#132621',
    text: '#f2fbf8',
    muted: '#9bb8ae',
    tagBg: 'rgba(124,247,196,0.15)',
    deco: '#213e36',
  },
  {
    id: 'signal',
    name: 'Signal Grid',
    accent: '#78a6ff',
    glow: '#d5e2ff',
    panel: '#0c1019',
    panelAlt: '#101728',
    text: '#f3f7ff',
    muted: '#95a2c6',
    tagBg: 'rgba(120,166,255,0.16)',
    deco: '#1b2540',
  },
];

const CARD_WIDTH = 1600;
const CARD_HEIGHT = 900;

function getTheme(themeId: LedgerExportThemeId): LedgerExportTheme {
  return LEDGER_EXPORT_THEMES.find((theme) => theme.id === themeId) ?? LEDGER_EXPORT_THEMES[0];
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortHash(value: string | undefined, lead = 10, tail = 8): string {
  if (!value) return '—';
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function buildFileStem(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): string {
  return `proofpass-${record.renterPublicId.toLowerCase()}-${record.attestationType}-${themeId}`;
}

export function renderLedgerAttestationSvg(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): string {
  const theme = getTheme(themeId);
  const title = `${record.attestationType.toUpperCase()} ATTESTATION`;
  const subtitle = `${record.renterPublicId} · verified for ${record.landlordPublicId}`;
  const issue = fmtDate(record.issuedAt);
  const expiry = fmtDate(record.expiresAt);
  const saved = fmtDate(record.savedAt);
  const wallet = shortHash(record.renterWalletAddress, 14, 10);
  const txHash = shortHash(record.txHash);
  const proofHash = shortHash(record.proofHash, 14, 10);
  const contractId = shortHash(record.contractId, 14, 10);
  const network = record.network.toUpperCase();
  const thresholdLabel = record.threshold;
  const body = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" fill="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.panel}"/>
        <stop offset="100%" stop-color="#050a0f"/>
      </linearGradient>
      <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${theme.glow}" stop-opacity="0.08"/>
      </linearGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="24" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${theme.deco}" stroke-width="1" opacity="0.35"/>
      </pattern>
    </defs>

    <rect width="1600" height="900" fill="url(#bg)"/>
    <rect width="1600" height="900" fill="url(#grid)"/>
    <circle cx="1330" cy="120" r="220" fill="${theme.accent}" opacity="0.10" filter="url(#softGlow)"/>
    <circle cx="280" cy="780" r="240" fill="${theme.glow}" opacity="0.06" filter="url(#softGlow)"/>
    <rect x="48" y="48" width="1504" height="804" rx="28" fill="rgba(4,10,16,0.48)" stroke="${theme.deco}" stroke-width="2"/>

    <rect x="92" y="92" width="330" height="44" rx="22" fill="${theme.tagBg}"/>
    <text x="118" y="121" fill="${theme.accent}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="2">PROOFPASS • SAVED ATTESTATION</text>

    <text x="92" y="220" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="66" font-weight="800">${esc(title)}</text>
    <text x="92" y="272" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="500">${esc(subtitle)}</text>

    <rect x="92" y="322" width="630" height="214" rx="24" fill="${theme.panelAlt}" stroke="${theme.deco}"/>
    <text x="128" y="376" fill="${theme.muted}" font-family="IBM Plex Mono, monospace" font-size="18" letter-spacing="1.5">QUALIFICATION PROVEN</text>
    <text x="128" y="458" fill="${theme.accent}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="800">${esc(thresholdLabel)}</text>
    <text x="128" y="506" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="26">${esc(record.attestationType.toUpperCase())} requirement satisfied</text>

    <rect x="92" y="572" width="630" height="220" rx="24" fill="${theme.panelAlt}" stroke="${theme.deco}"/>
    <text x="128" y="626" fill="${theme.muted}" font-family="IBM Plex Mono, monospace" font-size="18" letter-spacing="1.5">IDENTITY HANDOFF</text>
    <text x="128" y="688" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700">Renter ID: ${esc(record.renterPublicId)}</text>
    <text x="128" y="734" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700">Landlord ID: ${esc(record.landlordPublicId)}</text>
    <text x="128" y="776" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="24">Wallet reference: ${esc(wallet)}</text>

    <rect x="764" y="322" width="744" height="470" rx="24" fill="${theme.panelAlt}" stroke="${theme.deco}"/>
    <text x="804" y="376" fill="${theme.muted}" font-family="IBM Plex Mono, monospace" font-size="18" letter-spacing="1.5">AUDIT TRAIL</text>

    <text x="804" y="444" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Issued</text>
    <text x="1100" y="444" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${esc(issue)}</text>

    <text x="804" y="500" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Expires</text>
    <text x="1100" y="500" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${esc(expiry)}</text>

    <text x="804" y="556" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Saved to ledger</text>
    <text x="1100" y="556" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${esc(saved)}</text>

    <text x="804" y="612" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Network</text>
    <text x="1100" y="612" fill="${theme.text}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${esc(network)}</text>

    <text x="804" y="668" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Transaction</text>
    <text x="1100" y="668" fill="${theme.text}" font-family="IBM Plex Mono, monospace" font-size="22" font-weight="500">${esc(txHash)}</text>

    <text x="804" y="724" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Proof hash</text>
    <text x="1100" y="724" fill="${theme.text}" font-family="IBM Plex Mono, monospace" font-size="22" font-weight="500">${esc(proofHash)}</text>

    <text x="804" y="780" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="22">Contract</text>
    <text x="1100" y="780" fill="${theme.text}" font-family="IBM Plex Mono, monospace" font-size="22" font-weight="500">${esc(contractId)}</text>

    <text x="92" y="834" fill="${theme.muted}" font-family="Inter, Arial, sans-serif" font-size="20">Privacy preserved: the landlord sees qualification, threshold, expiry, and audit references — not the renter’s raw financial data.</text>
  </svg>`;
  return body.trim();
}

async function svgToPngDataUrl(svg: string): Promise<string> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to render SVG export card'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas export is not available in this browser');
    ctx.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function exportLedgerRecordPng(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): Promise<void> {
  const svg = renderLedgerAttestationSvg(record, themeId);
  const dataUrl = await svgToPngDataUrl(svg);
  downloadDataUrl(dataUrl, `${buildFileStem(record, themeId)}.png`);
}

export async function exportLedgerRecordPdf(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): Promise<void> {
  const svg = renderLedgerAttestationSvg(record, themeId);
  const dataUrl = await svgToPngDataUrl(svg);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [CARD_WIDTH, CARD_HEIGHT] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, CARD_WIDTH, CARD_HEIGHT, undefined, 'FAST');
  pdf.save(`${buildFileStem(record, themeId)}.pdf`);
}
