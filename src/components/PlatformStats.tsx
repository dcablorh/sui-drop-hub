import { useState, useEffect } from 'react';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE } from '@/lib/suiClient';
import { TrendingUp, Package, Percent, Zap } from 'lucide-react';

interface PlatformStatsData {
  totalDroplets: number;
  feePercentage: number;
}

export function PlatformStats() {
  const [stats, setStats] = useState<PlatformStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await suiClient.devInspectTransactionBlock({
          transactionBlock: (() => {
            const tx = new TransactionBlock();
            tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE}::get_platform_stats`,
              arguments: [tx.object(REGISTRY_ID)],
            });
            return tx;
          })(),
          sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
        });

        if (result.results?.[0]?.returnValues && result.results[0].returnValues.length >= 2) {
          // Parse as little-endian bytes
          const totalDroplets = result.results[0].returnValues[0][0].reduce((acc: number, byte: number, index: number) => 
            acc + (byte << (8 * index)), 0);
          const feePercentage = result.results[0].returnValues[1][0].reduce((acc: number, byte: number, index: number) => 
            acc + (byte << (8 * index)), 0);
          
          setStats({
            totalDroplets,
            feePercentage
          });
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <GradientCard className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-secondary/50 rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-secondary/50 rounded"></div>
              <div className="h-16 bg-secondary/50 rounded"></div>
            </div>
          </div>
        </CardContent>
      </GradientCard>
    );
  }

  return (
    <GradientCard className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Platform Statistics</CardTitle>
        </div>
        <CardDescription>
          Real-time statistics from the Sui Drop Hub platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Total Droplets Created
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {stats?.totalDroplets.toLocaleString() ?? 0}
              </span>
              <Badge variant="secondary" className="bg-sui-green/20 text-sui-green border-sui-green/30">
                <Zap className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Percent className="h-4 w-4" />
              Platform Fee
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {((stats?.feePercentage ?? 130) / 100).toFixed(1)}%
              </span>
              <Badge variant="outline" className="text-sui-yellow border-sui-yellow/30">
                {stats?.feePercentage ?? 130} basis points
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-gradient-hero border border-primary/20">
          <div className="text-sm text-center text-muted-foreground">
            Platform fee supports development and maintenance of Sui Drop Hub
          </div>
        </div>
      </CardContent>
    </GradientCard>
  );
}