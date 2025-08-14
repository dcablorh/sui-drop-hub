// src/components/SlushAdapter.tsx
import type {
	Wallet,
	WalletAccount,
	WalletModule,
	WindowWithSlush,
	WalletNotFoundError,
} from '@mysten/slush';

import type { WalletAdapter } from '@mysten/wallet-kit';

// For TypeScript global augmentation
declare global {
	interface Window extends WindowWithSlush {}
}

export class SlushWalletAdapter implements WalletAdapter {
	name = 'Slush Wallet';
	icon = ''; // TODO: put Slush logo data URI or URL
	installed: boolean;
	#wallet: Wallet | null = null;

	constructor() {
		this.installed = typeof window !== 'undefined' && !!window.slush;
	}

	async connect(): Promise<void> {
		if (!this.installed || !window.slush) {
			throw new Error('Slush Wallet not found');
		}
		try {
			this.#wallet = await window.slush.connect();
		} catch (err) {
			if (err instanceof Error && err.name === 'WalletNotFoundError') {
				throw new Error('Slush Wallet not found');
			}
			throw err;
		}
	}

	async disconnect(): Promise<void> {
		if (this.#wallet) {
			await this.#wallet.disconnect?.();
			this.#wallet = null;
		}
	}

	async getAccounts(): Promise<WalletAccount[]> {
		if (!this.#wallet) throw new Error('Wallet not connected');
		return this.#wallet.getAccounts();
	}

	// WalletAdapter requires `signAndExecuteTransaction` or similar
	async signAndExecuteTransaction(transaction: any) {
		if (!this.#wallet) throw new Error('Wallet not connected');
		return this.#wallet.signAndExecuteTransaction(transaction);
	}
}

// Helper to register the Slush adapter in WalletKit
export function createSlushWallet(): WalletModule {
	return {
		id: 'slush',
		name: 'Slush Wallet',
		installUrl: 'https://slushwallet.com', // Update with real URL
		getWallets() {
			return [new SlushWalletAdapter()];
		},
	};
}
