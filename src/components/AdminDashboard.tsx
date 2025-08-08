import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, CLOCK_ID } from '@/lib/suiClient';
import { 
  Shield, 
  Settings, 
  TrendingUp, 
  Percent, 
  Save,
  Package,
  Coins,
  Users,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlatformStats } from './PlatformStats';

const ADMIN_ADDRESS = '0xe2bf986ccb385f8e5d9500ce8332b69a5cee19579152c240c09213e80e9355b8';

interface AdminStats {
  totalDroplets: number;
  currentFeePercentage: number;
  totalFeesCollected: Record<string, number>;
}

export function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [newFeePercentage, setNewFeePercentage] = useState('');
  const [updating, setUpdating] = useState(false);
  const { currentAccount, isConnected, signAndExecuteTransactionBlock } = useWalletKit();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, [currentAccount]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
    }
  }, [isAdmin]);

  const checkAdminStatus = () => {
    if (!currentAccount) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const isAdminUser = currentAccount.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
    setIsAdmin(isAdminUser);
    setLoading(false);
  };

  const fetchAdminStats = async () => {
    try {
      // Get platform stats
      const statsResult = await suiClient.devInspectTransactionBlock({
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

      if (statsResult.results?.[0]?.returnValues && statsResult.results[0].returnValues.length >= 2) {
        const totalDroplets = parseInt(Buffer.from(statsResult.results[0].returnValues[0][0]).toString());
        const feePercentage = parseInt(Buffer.from(statsResult.results[0].returnValues[1][0]).toString());
        
        setAdminStats({
          totalDroplets,
          currentFeePercentage: feePercentage,
          totalFeesCollected: { 'SUI': 0 }, // Placeholder - would need additional contract methods
        });
        
        setNewFeePercentage((feePercentage / 100).toString());
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
      toast({
        title: "Error",
        description: "Failed to load admin statistics",
        variant: "destructive",
      });
    }
  };

  const updateFeePercentage = async () => {
    if (!currentAccount || !newFeePercentage) return;

    const feeValue = parseFloat(newFeePercentage);
    if (isNaN(feeValue) || feeValue < 0 || feeValue > 10) {
      toast({
        title: "Invalid Fee",
        description: "Fee percentage must be between 0% and 10%",
        variant: "destructive",
      });
      return;
    }

    const feeInBasisPoints = Math.round(feeValue * 100);

    try {
      setUpdating(true);

      const tx = new TransactionBlock();
      
      // Note: This would require the AdminCap object ID
      // For now, we'll show the interface but note that actual implementation
      // would need the AdminCap object to be tracked
      
      toast({
        title: "Feature Pending",
        description: "Fee update functionality requires AdminCap object integration",
        variant: "destructive",
      });

      /*
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::set_fee_percentage`,
        arguments: [
          tx.object(ADMIN_CAP_ID), // Would need to track this
          tx.object(REGISTRY_ID),
          tx.pure(feeInBasisPoints),
          tx.object(CLOCK_ID),
        ],
      });

      await signAndExecuteTransactionBlock({
        transactionBlock: tx,
      });

      toast({
        title: "Success",
        description: `Fee percentage updated to ${feeValue}%`,
      });

      fetchAdminStats();
      */
    } catch (error) {
      console.error('Failed to update fee percentage:', error);
      toast({
        title: "Error",
        description: "Failed to update fee percentage",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <GradientCard className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-secondary/50 rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-secondary/50 rounded"></div>
              <div className="h-4 bg-secondary/50 rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </GradientCard>
    );
  }

  if (!isConnected) {
    return (
      <GradientCard className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
          <p className="text-muted-foreground">
            Connect your wallet to access admin features
          </p>
        </CardContent>
      </GradientCard>
    );
  }

  if (!isAdmin) {
    return (
      <GradientCard className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground mb-4">
            You are not authorized to access this admin panel
          </p>
          <div className="bg-secondary/50 p-3 rounded text-sm">
            <p className="font-medium">Current wallet:</p>
            <code className="text-xs">{currentAccount?.address}</code>
            <p className="font-medium mt-2">Required admin wallet:</p>
            <code className="text-xs">{ADMIN_ADDRESS}</code>
          </div>
        </CardContent>
      </GradientCard>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <GradientCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Admin Dashboard</CardTitle>
            <Badge variant="default" className="bg-sui-purple/20 text-sui-purple border-sui-purple/30">
              Contract Owner
            </Badge>
          </div>
          <CardDescription>
            Manage platform settings and view administrative statistics
          </CardDescription>
        </CardHeader>
      </GradientCard>

      {/* Platform Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformStats />
        
        <GradientCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Platform Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="fee-percentage" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Platform Fee Percentage
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="fee-percentage"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={newFeePercentage}
                    onChange={(e) => setNewFeePercentage(e.target.value)}
                    placeholder="1.3"
                    className="max-w-24"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">%</span>
                  <Button
                    onClick={updateFeePercentage}
                    disabled={updating || !newFeePercentage}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updating ? 'Updating...' : 'Update'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {adminStats ? (adminStats.currentFeePercentage / 100).toFixed(1) : '1.3'}%
                  (Max 10%)
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-hero border border-primary/20">
                <div className="text-sm text-center space-y-2">
                  <p className="font-medium">⚠️ Implementation Note</p>
                  <p className="text-muted-foreground">
                    Fee updates require AdminCap object integration.
                    This feature shows the UI but needs backend completion.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </GradientCard>
      </div>

      {/* Additional Admin Stats */}
      {adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GradientCard>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Droplets</p>
                  <p className="text-2xl font-bold">{adminStats.totalDroplets.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </GradientCard>

          <GradientCard>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Percent className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Fee</p>
                  <p className="text-2xl font-bold">
                    {(adminStats.currentFeePercentage / 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </GradientCard>

          <GradientCard>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Coins className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fees Collected</p>
                  <p className="text-2xl font-bold">
                    {adminStats.totalFeesCollected.SUI || 0} SUI
                  </p>
                </div>
              </div>
            </CardContent>
          </GradientCard>
        </div>
      )}
    </div>
  );
}