import type { ZkState } from '../App';

export type ProofPassStage = 'idle' | 'proof' | 'done' | 'error';

export interface ProofPassQaConfig {
  walletAddress?: string;
  suppressNetwork?: boolean;
  zkState?: Partial<ZkState>;
  prove?: {
    attType?: 'income' | 'balance' | 'credit';
    privateValue?: string;
    threshold?: string;
    stage?: ProofPassStage;
    errorMsg?: string;
    txHash?: string;
    log?: string;
    selectedAssetCode?: string;
  };
  facility?: {
    formData?: {
      income?: string;
      balance?: string;
      creditScore?: string;
      selectedAssetId?: string;
      attestationType?: 'income' | 'balance' | 'credit';
      threshold?: string;
      verifyAddress?: string;
      verifyType?: 'income' | 'balance' | 'credit';
    };
    verificationResult?: {
      valid: boolean;
      address?: string;
      type?: string;
      threshold?: string;
      issuedAt?: string;
      expiresAt?: string;
      proofHash?: string;
      error?: string;
    };
    logs?: string[];
    progress?: number;
  };
}

declare global {
  interface Window {
    __ZKPROOF_QA__?: ProofPassQaConfig;
  }
}

export function getQaConfig(): ProofPassQaConfig | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__ZKPROOF_QA__;
}
