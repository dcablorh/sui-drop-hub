// src/main.tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { Buffer } from 'buffer';
import { WalletKitProvider } from '@mysten/wallet-kit';
import { createSlushWallet } from './components/SlushAdapter';

window.Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <WalletKitProvider
    defaultWallets={false}        // disable auto-built wallets if desired
    wallets={[createSlushWallet()]} // add Slush
    autoConnect
  >
    <App />
  </WalletKitProvider>
);
