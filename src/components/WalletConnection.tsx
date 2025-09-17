import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { GlassButton } from '@/components/ui/glass-button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut } from 'lucide-react';

export function WalletConnection() {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  return (
    <div className="flex items-center gap-2">
      {currentAccount ? (
        <>
          {/* Show connected wallet address */}
          <Badge variant="outline" className="flex items-center gap-1 bg-white/20 backdrop-blur-[10px] border-white/30 text-white">
            <Wallet size={16} />
            {currentAccount.address.slice(0, 6)}...
            {currentAccount.address.slice(-4)}
          </Badge>

          {/* Disconnect button */}
          <GlassButton
            variant="destructive"
            size="sm"
            onClick={() => disconnect()}
            className="flex items-center gap-1"
          >
            <LogOut size={16} />
            Disconnect
          </GlassButton>
        </>
      ) : (
        // Sui Wallet Connect Button — Works on desktop & mobile
        <ConnectButton connectText="Connect Wallet" />
      )}
    </div>
  );
}
