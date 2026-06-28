import { CONTRACT_ID, NETWORK } from './config';

export function getExplorerNetworkSlug(): 'testnet' | 'public' {
  return NETWORK === 'PUBLIC' ? 'public' : 'testnet';
}

export function getStellarExpertTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${getExplorerNetworkSlug()}/tx/${txHash}`;
}

export function getStellarExpertAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${getExplorerNetworkSlug()}/account/${address}`;
}

export function getStellarExpertContractUrl(contractId: string = CONTRACT_ID): string {
  return `https://stellar.expert/explorer/${getExplorerNetworkSlug()}/contract/${contractId}`;
}
