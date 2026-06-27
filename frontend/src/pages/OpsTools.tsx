import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTRACT_ID, NETWORK, RPC_URL } from '../lib/config';
import { getVerificationKey } from '../lib/prover';
import { getVerificationKeyStatus, type VerificationKeyStatus } from '../lib/stellar';

const EXPECTED_VK_BYTES = 1760;

type ExportState = {
  loading: boolean;
  message: string;
  vkLength: number;
};

const initialExportState: ExportState = {
  loading: false,
  message: '',
  vkLength: 0,
};

export default function OpsTools() {
  const [exportState, setExportState] = useState<ExportState>(initialExportState);
  const [statusLoading, setStatusLoading] = useState(false);
  const [onChainStatus, setOnChainStatus] = useState<VerificationKeyStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  const explorerUrl = useMemo(() => {
    if (!CONTRACT_ID) return '';
    const networkSlug = NETWORK === 'PUBLIC' ? 'public' : 'testnet';
    return `https://stellar.expert/explorer/${networkSlug}/contract/${CONTRACT_ID}`;
  }, []);

  const handleExportVk = async () => {
    setExportState({ loading: true, message: 'Generating verification key in the browser...', vkLength: 0 });
    try {
      const vk = await getVerificationKey();
      if (vk.length !== EXPECTED_VK_BYTES) {
        setExportState({
          loading: false,
          message:
            `Generated VK has ${vk.length} bytes, but the Soroban verifier expects ${EXPECTED_VK_BYTES}. Do not upload this file yet — the proving stack versions are mismatched.`,
          vkLength: vk.length,
        });
        return;
      }
      const byteCopy = Uint8Array.from(vk);
      const arrayBuffer = new ArrayBuffer(byteCopy.byteLength);
      new Uint8Array(arrayBuffer).set(byteCopy);
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'zkproof-vk.bin';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportState({
        loading: false,
        message:
          'Verification key generated locally and downloaded. Move the file to circuits/target/vk.bin, then run ./scripts/update-vk.sh.',
        vkLength: vk.length,
      });
    } catch (error: any) {
      setExportState({
        loading: false,
        message: `Browser VK export failed: ${error?.message ?? String(error)}`,
        vkLength: 0,
      });
    }
  };

  const handleCheckOnChainVk = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const status = await getVerificationKeyStatus();
      setOnChainStatus(status);
    } catch (error: any) {
      setStatusError(error?.message ?? String(error));
      setOnChainStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050a0f',
        color: '#e8ecf1',
        fontFamily: "'IBM Plex Mono', monospace",
        padding: '48px 24px 80px',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ color: '#00d4aa', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              PROOFPASS OPS
            </div>
            <h1 style={{ margin: 0, fontSize: '32px', lineHeight: 1.15, textTransform: 'uppercase' }}>
              Testnet deployment tools
            </h1>
            <p style={{ color: '#8899aa', maxWidth: '720px', lineHeight: 1.6, marginTop: '14px' }}>
              Use this page to prove the on-chain verification key is real, export a browser-generated key when the Node helper fails,
              and sanity-check the deployment before recording the demo.
            </p>
          </div>
          <Link
            to="/"
            style={{
              color: '#00d4aa',
              textDecoration: 'none',
              border: '1px solid rgba(0, 212, 170, 0.35)',
              padding: '10px 14px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Back to app
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '18px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid rgba(136,153,170,0.14)', padding: '18px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ color: '#8899aa', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>Network</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{NETWORK}</div>
            <div style={{ color: '#8899aa', fontSize: '11px', lineHeight: 1.5, marginTop: '10px', wordBreak: 'break-all' }}>{RPC_URL}</div>
          </div>
          <div style={{ border: '1px solid rgba(136,153,170,0.14)', padding: '18px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ color: '#8899aa', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>Contract</div>
            <div style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>{CONTRACT_ID || 'Missing VITE_CONTRACT_ID'}</div>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ color: '#00d4aa', fontSize: '11px', display: 'inline-block', marginTop: '10px' }}>
                Open Stellar Expert
              </a>
            )}
          </div>
          <div style={{ border: '1px solid rgba(136,153,170,0.14)', padding: '18px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ color: '#8899aa', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>Judge use</div>
            <div style={{ color: '#e8ecf1', fontSize: '12px', lineHeight: 1.6 }}>
              1. Export VK if needed.
              <br />2. Upload it with <code>./scripts/update-vk.sh</code>.
              <br />3. Re-check status here.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          <section style={{ border: '1px solid rgba(0,212,170,0.2)', padding: '24px', background: 'rgba(0,212,170,0.04)' }}>
            <div style={{ color: '#00d4aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
              Browser VK export
            </div>
            <p style={{ color: '#b9c3cf', fontSize: '12px', lineHeight: 1.6 }}>
              If <code>node frontend/scripts/gen-vk.mjs</code> fails with a Barretenberg memory/length error, use the browser prover path instead.
            </p>
            <button
              onClick={handleExportVk}
              disabled={exportState.loading}
              className="btn-zk btn-zk-primary"
              style={{ width: '100%', marginTop: '14px' }}
            >
              {exportState.loading ? 'GENERATING VK IN BROWSER...' : 'EXPORT VERIFICATION KEY'}
            </button>
            <div style={{ marginTop: '14px', color: exportState.message.startsWith('Browser VK export failed') ? '#ff9fb1' : '#8899aa', fontSize: '11px', lineHeight: 1.6 }}>
              {exportState.message || 'No export attempted yet.'}
            </div>
            {exportState.vkLength > 0 && (
              <div style={{ marginTop: '10px', color: '#00d4aa', fontSize: '11px' }}>
                VK size: {exportState.vkLength} bytes
              </div>
            )}
          </section>

          <section style={{ border: '1px solid rgba(136,153,170,0.16)', padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ color: '#00d4aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
              On-chain VK status
            </div>
            <p style={{ color: '#b9c3cf', fontSize: '12px', lineHeight: 1.6 }}>
              This checks whether the deployed contract still holds an all-zero placeholder verification key or a real uploaded one.
            </p>
            <button
              onClick={handleCheckOnChainVk}
              disabled={statusLoading}
              className="btn-zk btn-zk-secondary"
              style={{ width: '100%', marginTop: '14px' }}
            >
              {statusLoading ? 'CHECKING TESTNET CONTRACT...' : 'CHECK ON-CHAIN VK'}
            </button>
            {statusError && (
              <div style={{ marginTop: '14px', color: '#ff9fb1', fontSize: '11px', lineHeight: 1.6 }}>
                {statusError}
              </div>
            )}
            {onChainStatus && (
              <div style={{ marginTop: '14px', fontSize: '11px', lineHeight: 1.7 }}>
                <div style={{ color: onChainStatus.isPlaceholder || !onChainStatus.isExpectedLength ? '#ff9fb1' : '#00d4aa', fontWeight: 600 }}>
                  {onChainStatus.isPlaceholder
                    ? 'Placeholder VK detected'
                    : onChainStatus.isExpectedLength
                      ? 'Real VK detected'
                      : 'Invalid VK length detected'}
                </div>
                <div style={{ color: '#8899aa' }}>Stored bytes: {onChainStatus.byteLength}</div>
                {!onChainStatus.isPlaceholder && !onChainStatus.isExpectedLength && (
                  <div style={{ color: '#ff9fb1' }}>
                    Expected {EXPECTED_VK_BYTES} bytes for the Soroban verifier. The current contract likely stored a hex string instead of raw VK bytes.
                  </div>
                )}
                <div style={{ color: '#8899aa', wordBreak: 'break-all' }}>Hex preview: {onChainStatus.hexPreview || 'n/a'}</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
