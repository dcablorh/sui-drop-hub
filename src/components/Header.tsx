import { WalletConnection } from '@/components/WalletConnection';
import { Zap } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

export function Header() {
  return (
    <header className="border-b border-white/20 backdrop-blur-[12px] bg-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#3890FF] to-[#1E70D6] flex items-center justify-center shadow-[0_0_20px_rgba(56,144,255,0.4)]">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Sui Drop Hub
              </h1>
              
            </div>
          </div>
          <WalletConnection />
        </div>
      </div>
    </header>
  );
}
  )
}