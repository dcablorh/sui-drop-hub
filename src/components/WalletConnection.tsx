import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Badge } from '@/components/ui/badge';
import { Wallet } from 'lucide-react';

export function WalletConnection() {
  const account = useCurrentAccount();

  return (
    <div className="flex items-center gap-2">
      {account ? (
        <>
          {/* Show connected wallet address */}
          <Badge variant="outline" className="flex items-center gap-1">
            <Wallet size={16} />
            {account.address.slice(0, 6)}...
            {account.address.slice(-4)}
          </Badge>
        </>
      ) : null}
      
      {/* Connect Button from dapp-kit */}
      <ConnectButton />
    </div>
  );
}
