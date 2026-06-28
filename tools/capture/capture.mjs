import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../frontend/public/images');
mkdirSync(OUT, { recursive: true });

const HOLDER = 'GBJ3MJYVMXHKGKRIJBMKQOVIMDRGI4PWMEPZEVUSYWBQ5DQOTJU6R3GD';
const REAL_TX = 'd060c741e461738b4ba59413dbb288aee6d4266f40ca69b05e9c929e51cc4943';
const REAL_PROOF_HASH = 'de7ae94951fd835ffb96d2285dbf9344afcdcd18435f3d33845f49ce8a091cc3';

const stepBaseQa = {
  walletAddress: HOLDER,
  suppressNetwork: true,
  zkState: {
    income: '5000',
    threshold: '3000',
    attestationType: 'income',
    selectedAssetCode: 'USD',
  },
};

const targets = [
  {
    url: 'http://localhost:3000/prove',
    out: 'step1-data.jpg',
    full: true,
    wait: 1400,
    qa: {
      ...stepBaseQa,
      prove: {
        attType: 'income',
        privateValue: '5000',
        threshold: '3000',
        stage: 'idle',
        log: 'Enter private income, then generate a proof locally.',
        selectedAssetCode: 'USD',
      },
    },
  },
  {
    url: 'http://localhost:3000/prove',
    out: 'step2-proof.jpg',
    full: true,
    wait: 1800,
    qa: {
      ...stepBaseQa,
      prove: {
        attType: 'income',
        privateValue: '5000',
        threshold: '3000',
        stage: 'proof',
        log: 'Generating zero-knowledge proof locally — the raw salary never leaves the browser.',
        selectedAssetCode: 'USD',
      },
    },
  },
  {
    url: 'http://localhost:3000/prove',
    out: 'step3-chain.jpg',
    full: true,
    wait: 1800,
    qa: {
      ...stepBaseQa,
      prove: {
        attType: 'income',
        privateValue: '5000',
        threshold: '3000',
        stage: 'done',
        txHash: REAL_TX,
        log: '✅ Attestation confirmed on Stellar testnet.',
        selectedAssetCode: 'USD',
      },
    },
  },
  {
    url: 'http://localhost:3000/facility/verify',
    out: 'step4-verify.jpg',
    full: true,
    wait: 1800,
    qa: {
      ...stepBaseQa,
      facility: {
        formData: {
          attestationType: 'income',
          verifyType: 'income',
          threshold: '3000',
          verifyAddress: HOLDER,
        },
        logs: [
          'Verifying stored attestation on the Soroban contract...',
          '✅ Contract returned: valid attestation found.',
        ],
        progress: 100,
        verificationResult: {
          valid: true,
          address: HOLDER,
          type: 'income',
          threshold: '3000 / mo',
          issuedAt: 'Jun 27, 2026, 10:24 UTC',
          expiresAt: 'Jul 27, 2026, 10:24 UTC',
          proofHash: REAL_PROOF_HASH,
        },
      },
    },
  },
  {
    url: 'http://localhost:3000/',
    out: 'tech-noir.jpg',
    full: true,
    wait: 1000,
    qa: stepBaseQa,
  },
  {
    url: 'http://localhost:3000/prove',
    out: 'tech-bn254.jpg',
    full: true,
    wait: 1200,
    qa: {
      ...stepBaseQa,
      prove: {
        attType: 'income',
        privateValue: '5000',
        threshold: '3000',
        stage: 'proof',
        log: 'BN254 proof generation in progress…',
        selectedAssetCode: 'USD',
      },
    },
  },
  {
    url: 'http://localhost:3000/prove',
    out: 'tech-soroban.jpg',
    full: true,
    wait: 1200,
    qa: {
      ...stepBaseQa,
      prove: {
        attType: 'income',
        privateValue: '5000',
        threshold: '3000',
        stage: 'done',
        txHash: REAL_TX,
        log: 'Soroban accepted the attestation and stored it on-chain.',
        selectedAssetCode: 'USD',
      },
    },
  },
  {
    url: 'http://localhost:3000/facility/verify',
    out: 'tech-stellar.jpg',
    full: true,
    wait: 1200,
    qa: {
      ...stepBaseQa,
      facility: {
        formData: {
          attestationType: 'income',
          verifyType: 'income',
          threshold: '3000',
          verifyAddress: HOLDER,
        },
        logs: ['Stellar Expert / Soroban verification view'],
        progress: 100,
        verificationResult: {
          valid: true,
          address: HOLDER,
          type: 'income',
          threshold: '3000 / mo',
          issuedAt: 'Jun 27, 2026, 10:24 UTC',
          expiresAt: 'Jul 27, 2026, 10:24 UTC',
          proofHash: REAL_PROOF_HASH,
        },
      },
    },
  },
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

const page = await ctx.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[browser:error]', msg.text());
});

for (const t of targets) {
  console.log(`-> ${t.url} -> ${t.out}`);
  await page.addInitScript((qa) => {
    window.__ZKPROOF_QA__ = qa;
  }, t.qa);

  try {
    await page.goto(t.url, { waitUntil: 'load', timeout: 30000 });
  } catch {
    // keep going; the local preview is enough if assets are still streaming.
  }

  await page.waitForTimeout(t.wait);
  await page.screenshot({
    path: resolve(OUT, t.out),
    fullPage: t.full,
    type: 'jpeg',
    quality: 90,
  });
}

copyFileSync(resolve(OUT, 'step1-data.jpg'), resolve(OUT, 'tech-noir.jpg'));
copyFileSync(resolve(OUT, 'step2-proof.jpg'), resolve(OUT, 'tech-bn254.jpg'));
copyFileSync(resolve(OUT, 'step3-chain.jpg'), resolve(OUT, 'tech-soroban.jpg'));
copyFileSync(resolve(OUT, 'step4-verify.jpg'), resolve(OUT, 'tech-stellar.jpg'));

await browser.close();
console.log('done');
