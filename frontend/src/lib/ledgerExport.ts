import { jsPDF } from 'jspdf';
import type { LandlordLedgerRecord } from './profile';

export type LedgerExportThemeId = 'noir' | 'emerald' | 'signal';

export interface LedgerExportTheme {
  id: LedgerExportThemeId;
  name: string;
  shortLabel: string;
  accent: string;
  text: string;
  panel: string;
  muted: string;
  divider: string;
  baseImage: string;
}

export const LEDGER_EXPORT_THEMES: LedgerExportTheme[] = [
  {
    id: 'noir',
    name: 'Noir Terminal',
    shortLabel: 'Noir',
    accent: '#5fffe1',
    text: '#ecf4fb',
    panel: 'rgba(8, 17, 26, 0.78)',
    muted: '#a8b8c8',
    divider: 'rgba(0, 212, 170, 0.28)',
    baseImage: '/images/ledger-export-base-noir.png',
  },
  {
    id: 'emerald',
    name: 'Emerald Certificate',
    shortLabel: 'Emerald',
    accent: '#7cf7c4',
    text: '#f2fbf8',
    panel: 'rgba(15, 26, 24, 0.78)',
    muted: '#9bb8ae',
    divider: 'rgba(124, 247, 196, 0.28)',
    baseImage: '/images/ledger-export-base-emerald.png',
  },
  {
    id: 'signal',
    name: 'Signal Grid',
    shortLabel: 'Signal',
    accent: '#a4c2ff',
    text: '#f3f7ff',
    panel: 'rgba(12, 16, 25, 0.78)',
    muted: '#95a2c6',
    divider: 'rgba(120, 166, 255, 0.32)',
    baseImage: '/images/ledger-export-base-signal.png',
  },
];

const CARD_WIDTH = 1600;
const CARD_HEIGHT = 900;

function getTheme(themeId: LedgerExportThemeId): LedgerExportTheme {
  return LEDGER_EXPORT_THEMES.find((theme) => theme.id === themeId) ?? LEDGER_EXPORT_THEMES[0];
}

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildFileStem(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): string {
  return `proofpass-${record.renterPublicId.toLowerCase()}-${record.attestationType}-${themeId}`;
}

async function loadBaseImage(themeId: LedgerExportThemeId): Promise<HTMLImageElement> {
  const theme = getTheme(themeId);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load base export image: ${theme.baseImage}`));
    img.src = theme.baseImage;
  });
}

function drawOverlay(ctx: CanvasRenderingContext2D, record: LandlordLedgerRecord, theme: LedgerExportTheme): void {
  ctx.save();
  ctx.fillStyle = `${theme.accent}26`;
  roundRect(ctx, 92, 92, 360, 44, 22);
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.font = '700 20px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('PROOFPASS • SAVED ATTESTATION', 118, 114);
  ctx.restore();

  // Big title
  ctx.save();
  ctx.fillStyle = theme.text;
  ctx.font = '800 64px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${record.attestationType.toUpperCase()} ATTESTATION`, 92, 220);
  ctx.restore();

  // Subtitle
  ctx.save();
  ctx.fillStyle = theme.muted;
  ctx.font = '500 26px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(`${record.renterPublicId} · verified for ${record.landlordPublicId}`, 92, 262);
  ctx.restore();

  // Qualification card (left)
  drawPanel(ctx, theme, 92, 322, 630, 220);
  ctx.fillStyle = theme.muted;
  ctx.font = '700 16px "IBM Plex Mono", "Menlo", monospace';
  ctx.fillText('QUALIFICATION PROVEN', 128, 360);
  ctx.fillStyle = theme.accent;
  ctx.font = '800 64px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(record.threshold, 128, 444);
  ctx.fillStyle = theme.text;
  ctx.font = '500 22px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(`${record.attestationType.toUpperCase()} requirement satisfied`, 128, 488);

  // Identity card (left bottom)
  drawPanel(ctx, theme, 92, 572, 630, 220);
  ctx.fillStyle = theme.muted;
  ctx.font = '700 16px "IBM Plex Mono", "Menlo", monospace';
  ctx.fillText('IDENTITY HANDOFF', 128, 610);
  ctx.fillStyle = theme.text;
  ctx.font = '700 26px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(`Renter ID: ${record.renterPublicId}`, 128, 660);
  ctx.fillText(`Landlord ID: ${record.landlordPublicId}`, 128, 700);
  ctx.fillStyle = theme.muted;
  ctx.font = '400 18px "IBM Plex Mono", "Menlo", monospace';
  const wallet = shortText(record.renterWalletAddress, 14, 10);
  ctx.fillText(`Wallet reference: ${wallet}`, 128, 740);

  // Audit card (right)
  drawPanel(ctx, theme, 764, 322, 744, 470);
  ctx.fillStyle = theme.muted;
  ctx.font = '700 16px "IBM Plex Mono", "Menlo", monospace';
  ctx.fillText('AUDIT TRAIL', 804, 360);

  const rows: Array<[string, string]> = [
    ['Issued', fmtDate(record.issuedAt)],
    ['Expires', fmtDate(record.expiresAt)],
    ['Saved to ledger', fmtDate(record.savedAt)],
    ['Network', record.network.toUpperCase()],
    ['Transaction', shortText(record.txHash, 12, 10) || '—'],
    ['Proof hash', shortText(record.proofHash, 14, 10) || '—'],
    ['Contract', shortText(record.contractId, 14, 10) || '—'],
  ];

  let rowY = 408;
  for (const [label, value] of rows) {
    ctx.fillStyle = theme.muted;
    ctx.font = '500 20px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(label, 804, rowY);
    ctx.fillStyle = theme.text;
    ctx.font = '600 20px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(value, 1100, rowY);
    // divider line
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(804, rowY + 16);
    ctx.lineTo(1468, rowY + 16);
    ctx.stroke();
    rowY += 54;
  }

  // Footer
  ctx.fillStyle = theme.muted;
  ctx.font = '400 18px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    "Privacy preserved: the landlord sees qualification, threshold, expiry, and audit references — not the renter's raw financial data.",
    92, 836
  );
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  theme: LedgerExportTheme,
  x: number, y: number, w: number, h: number
) {
  ctx.save();
  ctx.fillStyle = theme.panel;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}33`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shortText(value: string | undefined, lead: number, tail: number): string {
  if (!value) return '';
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

async function renderToCanvas(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): Promise<HTMLCanvasElement> {
  const theme = getTheme(themeId);
  const baseImage = await loadBaseImage(themeId);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas export is not available in this browser');

  ctx.drawImage(baseImage, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawOverlay(ctx, record, theme);

  return canvas;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode attestation PNG'));
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportLedgerRecordPng(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): Promise<void> {
  const canvas = await renderToCanvas(record, themeId);
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, `${buildFileStem(record, themeId)}.png`);
}

export async function exportLedgerRecordPdf(record: LandlordLedgerRecord, themeId: LedgerExportThemeId): Promise<void> {
  const canvas = await renderToCanvas(record, themeId);
  const blob = await canvasToPngBlob(canvas);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read PNG for PDF embedding'));
    reader.readAsDataURL(blob);
  });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [CARD_WIDTH, CARD_HEIGHT] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, CARD_WIDTH, CARD_HEIGHT, undefined, 'FAST');
  pdf.save(`${buildFileStem(record, themeId)}.pdf`);
}