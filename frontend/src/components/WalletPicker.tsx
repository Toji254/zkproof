import { useState } from "react";
import { useAvailableWallets, connectWithWallet } from "../lib/wallets";

const isImageUrl = (value?: string) =>
  Boolean(value && /^https?:\/\//i.test(value));

interface WalletPickerProps {
  open: boolean;
  onClose: () => void;
  onConnected: (address: string, walletId: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "#0a1118",
    border: "1px solid rgba(0, 212, 170, 0.25)",
    borderRadius: "12px",
    padding: "28px",
    width: "460px",
    maxWidth: "92vw",
    maxHeight: "80vh",
    overflowY: "auto",
    color: "#e8ecf1",
    fontFamily: "'IBM Plex Mono', monospace",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6)",
  },
  header: {
    fontSize: "14px",
    color: "#00d4aa",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "20px",
    fontWeight: 600,
  },
  walletList: {
    display: "grid",
    gap: "10px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    padding: "14px 12px",
    background: "rgba(0, 212, 170, 0.04)",
    border: "1px solid rgba(136, 153, 170, 0.12)",
    borderRadius: "8px",
    transition: "all 0.15s",
  },
  listItemHover: {
    background: "rgba(0, 212, 170, 0.08)",
    borderColor: "rgba(0, 212, 170, 0.32)",
  },
  walletInfo: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: 0,
    flex: 1,
  },
  icon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(136, 153, 170, 0.12)",
  },
  iconImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    background: "#ffffff",
  },
  iconFallback: {
    fontSize: "18px",
    lineHeight: 1,
  },
  walletMeta: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  walletName: {
    color: "#e8ecf1",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  walletStatus: {
    color: "#8899aa",
    fontSize: "10px",
    lineHeight: 1.5,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
    marginLeft: "12px",
  },
  actionBtn: {
    border: "1px solid rgba(0, 212, 170, 0.25)",
    background: "rgba(0, 212, 170, 0.08)",
    color: "#00d4aa",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    whiteSpace: "nowrap",
  },
  installBtn: {
    border: "1px solid rgba(136, 153, 170, 0.2)",
    background: "transparent",
    color: "#e8ecf1",
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center",
    color: "#8899aa",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  hint: {
    marginTop: "16px",
    padding: "12px",
    background: "rgba(255, 68, 102, 0.08)",
    border: "1px solid rgba(255, 68, 102, 0.3)",
    borderRadius: "6px",
    fontSize: "11px",
    color: "#ff8a99",
    lineHeight: 1.5,
  },
  cancelBtn: {
    marginTop: "16px",
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: "1px solid rgba(136, 153, 170, 0.2)",
    color: "#8899aa",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    fontFamily: "'IBM Plex Mono', monospace",
  },
};

export default function WalletPicker({ open, onClose, onConnected }: WalletPickerProps) {
  const wallets = useAvailableWallets();
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  if (!open) return null;

  const handleConnect = async (id: string) => {
    setError(null);
    setConnecting(id);
    try {
      const address = await connectWithWallet(id);
      onConnected(address, id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Connection failed");
    } finally {
      setConnecting(null);
    }
  };

  const handleInstall = (url?: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>CONNECT A STELLAR WALLET</div>

        {wallets.length === 0 ? (
          <div style={styles.empty}>
            No Stellar wallets could be loaded right now.
            <br />
            <br />
            Try reloading the page, then install or enable a supported wallet like Freighter, xBull, Albedo, Lobstr, Hana, or Rabet.
          </div>
        ) : (
          <div style={styles.walletList}>
            {wallets.map((w) => (
              <div
                key={w.id}
                style={{
                  ...styles.listItem,
                  ...(hovered === w.id ? styles.listItemHover : {}),
                  opacity: connecting && connecting !== w.id ? 0.5 : 1,
                }}
                onMouseEnter={() => setHovered(w.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={styles.walletInfo}>
                  <span style={styles.icon} aria-hidden="true">
                    {isImageUrl(w.icon) ? (
                      <img
                        src={w.icon}
                        alt=""
                        style={styles.iconImage}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span style={styles.iconFallback}>{w.icon ?? "🔐"}</span>
                    )}
                  </span>

                  <span style={styles.walletMeta}>
                    <span style={styles.walletName}>{w.name}</span>
                    <span style={styles.walletStatus}>{w.statusText}</span>
                  </span>
                </div>

                <div style={styles.actionGroup}>
                  {connecting === w.id ? (
                    <span style={{ fontSize: "10px", color: "#00d4aa", whiteSpace: "nowrap" }}>
                      CONNECTING…
                    </span>
                  ) : w.canConnect ? (
                    <button
                      type="button"
                      style={styles.actionBtn}
                      onClick={() => handleConnect(w.id)}
                      disabled={!!connecting}
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{ ...styles.actionBtn, ...styles.installBtn }}
                      onClick={() => handleInstall(w.url)}
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div style={styles.hint}>{error}</div>}

        <button style={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
