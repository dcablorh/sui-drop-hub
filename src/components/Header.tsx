import { WalletConnection } from '@/components/WalletConnection';
import { Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Sui Drop Hub
              </h1>
              <p className="text-sm text-muted-foreground">
                Airdrop Platform on Sui Network
              </p>
            </div>
          </div>
          <WalletConnection />
        </div>
      </div>
    </header>
  );
}