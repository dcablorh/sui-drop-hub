import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE } from '@/lib/suiClient';
import { 
  User, 
  Send, 
  Gift, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Trash2,
  Filter
} from 'lucide-react';
import { DropletDetails } from './DropletDetails';
import { useToast } from '@/hooks/use-toast';
import { useSuiEvents } from '@/hooks/useSuiEvents';

type FilterType = 'all' | 'active' | 'expired' | 'completed';

interface DropletSummary {
  dropletId: string;
  totalAmount: number;
  claimedAmount: number;
  receiverLimit: number;
  numClaimed: number;
  expiryTime: number;
  isExpired: boolean;
  isClosed: boolean;
  message: string;
}

export function UserDashboard() {
  const [createdDroplets, setCreatedDroplets] = useState<string[]>([]);
  const [claimedDroplets, setClaimedDroplets] = useState<string[]>([]);
  const [createdDetails, setCreatedDetails] = useState<DropletSummary[]>([]);
  const [claimedDetails, setClaimedDetails] = useState<DropletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDroplet, setSelectedDroplet] = useState<string | null>(null);
  const [createdFilter, setCreatedFilter] = useState<FilterType>('all');
  const [claimedFilter, setClaimedFilter] = useState<FilterType>('all');
  const { currentAccount, isConnected } = useWalletKit();
  const { toast } = useToast();

  useEffect(() => {
    if (isConnected && currentAccount) {
      fetchUserHistory();
    }
  }, [isConnected, currentAccount]);

  const fetchUserHistory = async () => {
    if (!currentAccount) return;

    try {
      setLoading(true);
      
      // Use the enhanced get_user_activity_summary function
      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::get_user_activity_summary`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(currentAccount.address)],
          });
          return tx;
        })(),
        sender: currentAccount.address,
      });

      if (result.results?.[0]?.returnValues && result.results[0].returnValues.length >= 4) {
        // Parse the tuple (vector<String>, vector<String>, u64, u64)
        const createdResult = result.results[0].returnValues[0];
        const claimedResult = result.results[0].returnValues[1];
        const createdCountResult = result.results[0].returnValues[2];
        const claimedCountResult = result.results[0].returnValues[3];
        
        // Parse vectors - for now using mock data until BCS parsing is implemented
        const created = parseStringVector(createdResult);
        const claimed = parseStringVector(claimedResult);
        
        // Parse counts (little-endian u64)
        const createdCount = createdCountResult[0]?.reduce((acc: number, byte: number, index: number) => 
          acc + (byte << (8 * index)), 0) || 0;
        const claimedCount = claimedCountResult[0]?.reduce((acc: number, byte: number, index: number) => 
          acc + (byte << (8 * index)), 0) || 0;
        
        console.log('Fetched user activity:', { 
          created, 
          claimed, 
          createdCount, 
          claimedCount 
        });
        
        // Use actual counts for better mock data generation
        const mockCreatedIds = Array.from({length: createdCount}, (_, i) => `MOCK${i.toString().padStart(2, '0')}`);
        const mockClaimedIds = Array.from({length: claimedCount}, (_, i) => `CLMD${i.toString().padStart(2, '0')}`);
        
        setCreatedDroplets(mockCreatedIds);
        setClaimedDroplets(mockClaimedIds);

        // Generate realistic mock data based on actual counts
        const mockCreatedDetails = mockCreatedIds.map(id => createMockDropletSummary(id, true));
        const mockClaimedDetails = mockClaimedIds.map(id => createMockDropletSummary(id, false));
        
        setCreatedDetails(mockCreatedDetails);
        setClaimedDetails(mockClaimedDetails);
      } else {
        // No activity found
        setCreatedDroplets([]);
        setClaimedDroplets([]);
        setCreatedDetails([]);
        setClaimedDetails([]);
      }
    } catch (error) {
      console.error('Failed to fetch user history:', error);
      toast({
        title: "Error",
        description: "Failed to load your droplet history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Live refresh on-chain events
  useSuiEvents(() => {
    if (isConnected && currentAccount) {
      fetchUserHistory();
    }
  });

  const parseStringVector = (result: any): string[] => {
    try {
      if (!result || !result[0]) return [];
      
      // The result should be a BCS-encoded vector of strings
      // For now, return empty array until proper BCS parsing is implemented
      console.log('Raw vector result:', result);
      return [];
    } catch (error) {
      console.error('Error parsing string vector:', error);
      return [];
    }
  };

  const createMockDropletSummary = (dropletId: string, isCreated: boolean = true): DropletSummary => {
    const now = Date.now();
    const isActive = Math.random() > 0.3;
    const isExpired = !isActive && Math.random() > 0.5;
    const isClosed = !isActive && !isExpired;
    
    return {
      dropletId,
      totalAmount: Math.floor(Math.random() * 5000000000) + 500000000, // 0.5-5 SUI
      claimedAmount: Math.floor(Math.random() * 2000000000), // Random claimed amount
      receiverLimit: Math.floor(Math.random() * 20) + 5, // 5-25 receivers
      numClaimed: Math.floor(Math.random() * 8),
      expiryTime: now + (isExpired ? -Math.random() * 24 * 60 * 60 * 1000 : Math.random() * 48 * 60 * 60 * 1000),
      isExpired,
      isClosed,
      message: isCreated 
        ? `🎁 Welcome bonus from Sui Drop Hub! ID: ${dropletId}` 
        : `🎉 Claimed from droplet ${dropletId}`,
    };
  };

  const filterDroplets = (droplets: DropletSummary[], filter: FilterType): DropletSummary[] => {
    switch (filter) {
      case 'active':
        return droplets.filter(d => !d.isExpired && !d.isClosed);
      case 'expired':
        return droplets.filter(d => d.isExpired);
      case 'completed':
        return droplets.filter(d => d.isClosed || d.numClaimed >= d.receiverLimit);
      default:
        return droplets;
    }
  };

  const getStatusBadge = (droplet: DropletSummary) => {
    if (droplet.isClosed) {
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Closed</Badge>;
    }
    if (droplet.isExpired) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    if (droplet.numClaimed >= droplet.receiverLimit) {
      return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    return <Badge variant="default" className="bg-sui-green/20 text-sui-green border-sui-green/30">
      <CheckCircle className="h-3 w-3 mr-1" />Active
    </Badge>;
  };

  const formatTimeRemaining = (expiryTime: number) => {
    const now = Date.now();
    const timeLeft = expiryTime - now;
    
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const DropletCard = ({ droplet, showCleanup = false }: { droplet: DropletSummary; showCleanup?: boolean }) => (
    <GradientCard key={droplet.dropletId} className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm bg-secondary/50 px-2 py-1 rounded">
            {droplet.dropletId}
          </code>
          {getStatusBadge(droplet)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDroplet(droplet.dropletId)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {showCleanup && droplet.isExpired && !droplet.isClosed && (
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-1" />
              Cleanup
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Total Amount:</span>
          <p className="font-medium">{(droplet.totalAmount / 1e9).toFixed(4)} SUI</p>
        </div>
        <div>
          <span className="text-muted-foreground">Claims:</span>
          <p className="font-medium">{droplet.numClaimed} / {droplet.receiverLimit}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Remaining:</span>
          <p className="font-medium text-sui-green">
            {((droplet.totalAmount - droplet.claimedAmount) / 1e9).toFixed(4)} SUI
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Expires:</span>
          <p className="font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeRemaining(droplet.expiryTime)}
          </p>
        </div>
      </div>
      
      {droplet.message && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <span className="text-muted-foreground text-xs">Message:</span>
          <p className="text-sm mt-1 italic">"{droplet.message}"</p>
        </div>
      )}
    </GradientCard>
  );

  if (!isConnected) {
    return (
      <GradientCard className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground">
            Connect your wallet to view your droplet history
          </p>
        </CardContent>
      </GradientCard>
    );
  }

  if (selectedDroplet) {
    return (
      <DropletDetails
        dropletId={selectedDroplet}
        onClose={() => setSelectedDroplet(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <GradientCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6" />
            My Dashboard
          </CardTitle>
          <CardDescription>
            Track your created and claimed droplets
          </CardDescription>
        </CardHeader>
      </GradientCard>

      <Tabs defaultValue="created" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border/50">
          <TabsTrigger value="created" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Created Droplets ({createdDroplets.length})
          </TabsTrigger>
          <TabsTrigger value="claimed" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Claimed Droplets ({claimedDroplets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-2">
              {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                <Button
                  key={filter}
                  variant={createdFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreatedFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-secondary/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterDroplets(createdDetails, createdFilter).map((droplet) => (
                <DropletCard key={droplet.dropletId} droplet={droplet} showCleanup />
              ))}
              {filterDroplets(createdDetails, createdFilter).length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No droplets found for the selected filter
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="claimed" className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-2">
              {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                <Button
                  key={filter}
                  variant={claimedFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setClaimedFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-secondary/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterDroplets(claimedDetails, claimedFilter).map((droplet) => (
                <DropletCard key={droplet.dropletId} droplet={droplet} />
              ))}
              {filterDroplets(claimedDetails, claimedFilter).length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No droplets found for the selected filter
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}