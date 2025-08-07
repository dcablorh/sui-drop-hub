import { ConnectButton, useWalletKit } from '@mysten/wallet-kit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut } from 'lucide-react';

export function WalletConnection() {
  const { isConnected, currentAccount, disconnect } = useWalletKit();

  if (isConnected && currentAccount) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground">
          <Wallet className="h-3 w-3 mr-1" />
          {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="border-border/50 hover:border-primary/30"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-all duration-300 shadow-glow rounded-md">
      <ConnectButton connectText="Connect Wallet" />
    </div>
  );
}