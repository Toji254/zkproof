import { footerConfig } from '../config';

export default function Footer() {
  if (!footerConfig.copyrightText && !footerConfig.statusText) {
    return null;
  }

  return (
    <footer
      style={{
        background: '#0a1118',
        color: '#e8ecf1',
        borderTop: '1px solid rgba(136, 153, 170, 0.12)',
        padding: '32px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '12px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <span style={{ color: '#00d4aa' }}>{footerConfig.copyrightText}</span>
      <span style={{ color: '#556677' }}>{footerConfig.statusText}</span>
    </footer>
  );
}
