import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { siteConfig } from './config';
import Hero from './sections/Hero';
import Manifesto from './sections/Manifesto';
import Facilities from './sections/Facilities';
import Observation from './sections/Observation';
import Archives from './sections/Archives';
import Footer from './sections/Footer';
import FacilityDetail from './pages/FacilityDetail';
import OpsTools from './pages/OpsTools';
import ProveAttest from './pages/ProveAttest';
import RoleSelect from './pages/RoleSelect';
import QualifiedRenter from './pages/QualifiedRenter';
import WalletPicker from './components/WalletPicker';
import DemoTour from './components/DemoTour';
import { setConnectedAddress as setStellarAddress, getConnectedAddress as getStoredStellarAddress, disconnectWallet } from './lib/stellar';
import { getQaConfig } from './lib/qa';

export interface ZkState {
  income: string;
  balance: string;
  creditScore: string;
  selectedAssetId: string;
  selectedAssetCode: string;
  selectedAssetIssuer: string;
  commitment: string;
  threshold: string;
  attestationType: 'income' | 'balance' | 'credit';
  proof: string;
  publicInputs: string[] | null;
  txHash: string;
}

const initialZkState: ZkState = {
  income: '',
  balance: '',
  creditScore: '',
  selectedAssetId: '',
  selectedAssetCode: 'USD',
  selectedAssetIssuer: '',
  commitment: '',
  threshold: '3000',
  attestationType: 'income',
  proof: '',
  publicInputs: null,
  txHash: '',
};

function Home({
  walletAddress,
  connect,
  disconnect,
}: {
  walletAddress: string;
  connect: () => void;
  disconnect: () => void;
}) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }, [hash]);

  return (
    <>
      <main>
        <Hero
          walletAddress={walletAddress}
          connect={connect}
          disconnect={disconnect}
        />
        <Manifesto />
        <Facilities />
        <Observation />
        <Archives />
      </main>
      <Footer />
      <DemoTour walletAddress={walletAddress} />
    </>
  );
}

function App() {
  const qa = getQaConfig();
  const [walletAddress, setWalletAddress] = useState<string>(() => qa?.walletAddress ?? getStoredStellarAddress() ?? '');
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  // Shared ZK workflow state — passed into FacilityDetail for the four steps.
  const [zkState, setZkState] = useState<ZkState>(() => ({
    ...initialZkState,
    ...qa?.zkState,
  }));

  useEffect(() => {
    document.title = siteConfig.siteTitle || 'zkProof — ZK Financial Attestation';
    document.documentElement.lang = siteConfig.language || 'en';

    let metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = siteConfig.siteDescription || '';
  }, []);

  useEffect(() => {
    if (qa?.walletAddress) return;

    const storedAddress = getStoredStellarAddress();
    if (storedAddress) {
      setWalletAddress(storedAddress);
    }
  }, [qa?.walletAddress]);

  // Opens the wallet picker modal. The picker handles the actual connection.
  const handleConnect = () => {
    setPickerOpen(true);
  };

  // Called by WalletPicker once a wallet has been chosen + connected.
  const handleWalletConnected = (address: string, _walletId: string) => {
    setStellarAddress(address);
    setWalletAddress(address);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setStellarAddress(null);
    setWalletAddress("");
  };

  return (
    <>
      <Routes>
        <Route path="/start" element={<RoleSelect />} />
        <Route
          path="/"
          element={
            <Home
              walletAddress={walletAddress}
              connect={handleConnect}
              disconnect={handleDisconnect}
            />
          }
        />
        <Route
          path="/prove"
          element={
            <ProveAttest
              walletAddress={walletAddress}
              connectWallet={handleConnect}
              zkState={zkState}
              setZkState={setZkState}
            />
          }
        />
        {/* Legacy step routes → unified prove page */}
        <Route path="/facility/enter-data" element={<ProveAttest walletAddress={walletAddress} connectWallet={handleConnect} zkState={zkState} setZkState={setZkState} />} />
        <Route path="/facility/generate-proof" element={<ProveAttest walletAddress={walletAddress} connectWallet={handleConnect} zkState={zkState} setZkState={setZkState} />} />
        <Route path="/facility/on-chain-attestation" element={<ProveAttest walletAddress={walletAddress} connectWallet={handleConnect} zkState={zkState} setZkState={setZkState} />} />
        <Route
          path="/facility/:slug"
          element={
            <FacilityDetail
              walletAddress={walletAddress}
              connectWallet={handleConnect}
              zkState={zkState}
              setZkState={setZkState}
            />
          }
        />
        <Route path="/ops" element={<OpsTools />} />
        <Route path="/qualified" element={<QualifiedRenter />} />
      </Routes>

      <WalletPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConnected={handleWalletConnected}
      />
    </>
  );
}

export default App;
