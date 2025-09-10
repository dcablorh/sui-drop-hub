import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { useMemo } from 'react';

export interface CoinBalance {
  coinType: string;
  balance: string;
  symbol: string;
  decimals: number;
  formatted: string;
}

export function useWalletCoins() {
  const currentAccount = useCurrentAccount();

  const { data: allBalances, isLoading } = useSuiClientQuery(
    'getAllBalances',
    {
      owner: currentAccount?.address || '',
    },
    {
      enabled: !!currentAccount?.address,
      refetchInterval: 10000, // Refetch every 10 seconds for real-time balance updates
      staleTime: 5000, // Consider data stale after 5 seconds
    }
  );

  const coinBalances = useMemo(() => {
    if (!allBalances) return [];
    
    return allBalances
      .filter(balance => parseInt(balance.totalBalance) > 0) // Only show coins with balance
      .map(balance => {
        // Parse coin type to get symbol
        let symbol = 'Unknown';
        let decimals = 9; // Default for SUI
        
        if (balance.coinType === '0x2::sui::SUI') {
          symbol = 'SUI';
          decimals = 9;
        } else {
          // Extract symbol from coin type (last part after ::)
          const parts = balance.coinType.split('::');
          if (parts.length >= 3) {
            symbol = parts[parts.length - 1].toUpperCase();
          }
        }

        // Format balance with decimals
        const balanceNum = parseInt(balance.totalBalance);
        const formatted = (balanceNum / Math.pow(10, decimals)).toFixed(decimals === 9 ? 4 : 2);

        return {
          coinType: balance.coinType,
          balance: balance.totalBalance,
          symbol,
          decimals,
          formatted: `${formatted} ${symbol}`,
        } as CoinBalance;
      })
      .sort((a, b) => {
        // Sort SUI first, then by balance descending
        if (a.symbol === 'SUI') return -1;
        if (b.symbol === 'SUI') return 1;
        return parseInt(b.balance) - parseInt(a.balance);
      });
  }, [allBalances]);

  return {
    coinBalances,
    isLoading,
    hasCoins: coinBalances.length > 0,
  };
}