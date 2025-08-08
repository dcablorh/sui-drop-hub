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
      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::get_user_history`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(currentAccount.address)],
          });
          return tx;
        })(),
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

      if (result.results?.[0]?.returnValues && result.results[0].returnValues.length >= 2) {
        // Parse created droplets
        const createdBytes = result.results[0].returnValues[0][0];
        const created = parseDropletIds(createdBytes);
        setCreatedDroplets(created);

        // Parse claimed droplets
        const claimedBytes = result.results[0].returnValues[1][0];
        const claimed = parseDropletIds(claimedBytes);
        setClaimedDroplets(claimed);

        // Fetch details for each droplet
        await Promise.all([
          fetchDropletDetails(created, setCreatedDetails),
          fetchDropletDetails(claimed, setClaimedDetails),
        ]);
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

  const parseDropletIds = (bytes: number[]): string[] => {
    // Parse vector of strings from Move bytes
    try {
      if (bytes.length === 0) return [];
      
      const ids: string[] = [];
      let offset = 0;
      
      // Skip vector length bytes
      offset += 4;
      
      while (offset < bytes.length) {
        // Read string length
        if (offset + 4 > bytes.length) break;
        const strLen = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
        offset += 4;
        
        if (offset + strLen > bytes.length) break;
        
        // Read string content
        const strBytes = bytes.slice(offset, offset + strLen);
        const str = String.fromCharCode(...strBytes);
        ids.push(str);
        offset += strLen;
      }
      
      return ids;
    } catch {
      return [];
    }
  };

  const fetchDropletDetails = async (dropletIds: string[], setSummary: (details: DropletSummary[]) => void) => {
    const summaries: DropletSummary[] = [];

    for (const dropletId of dropletIds) {
      try {
        // Get droplet address
        const addressResult = await suiClient.devInspectTransactionBlock({
          transactionBlock: (() => {
            const tx = new TransactionBlock();
            tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
              arguments: [tx.object(REGISTRY_ID), tx.pure(dropletId)],
            });
            return tx;
          })(),
          sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
        });

        if (!addressResult.results?.[0]?.returnValues?.[0]) continue;

        const returnValue = addressResult.results[0].returnValues[0];
        const bytes = returnValue[0];
        
        if (bytes.length === 1 && bytes[0] === 0) continue;

        const addressBytes = bytes.slice(1);
        const dropletAddress = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // Get droplet object
        const dropletObject = await suiClient.getObject({
          id: dropletAddress,
          options: { showContent: true }
        });

        if (!dropletObject.data?.content || dropletObject.data.content.dataType !== 'moveObject') continue;

        const fields = (dropletObject.data.content as any).fields;
        const currentTime = Date.now();

        const summary: DropletSummary = {
          dropletId: fields.droplet_id,
          totalAmount: parseInt(fields.total_amount),
          claimedAmount: parseInt(fields.claimed_amount),
          receiverLimit: parseInt(fields.receiver_limit),
          numClaimed: parseInt(fields.num_claimed),
          expiryTime: parseInt(fields.expiry_time),
          isExpired: currentTime >= parseInt(fields.expiry_time),
          isClosed: fields.is_closed,
          message: fields.message || '',
        };

        summaries.push(summary);
      } catch (error) {
        console.error(`Failed to fetch details for droplet ${dropletId}:`, error);
      }
    }

    setSummary(summaries);
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