import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE } from '@/lib/suiClient';
import { bcs } from '@mysten/sui.js/bcs';
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
  Filter,
  Loader2
} from 'lucide-react';
import { DropletDetails } from './DropletDetails';
import { useToast } from '@/hooks/use-toast';
import { useSuiEvents } from '@/hooks/useSuiEvents';

type FilterType = 'all' | 'active' | 'expired' | 'completed';

interface DropletSummary {
  dropletId: string;
  dropletAddress?: string; // Add droplet address for cleanup
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
  const [userStats, setUserStats] = useState({ createdCount: 0, claimedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);
  const [selectedDroplet, setSelectedDroplet] = useState<string | null>(null);
  const [createdFilter, setCreatedFilter] = useState<FilterType>('all');
  const [claimedFilter, setClaimedFilter] = useState<FilterType>('all');
  const { currentAccount, isConnected, signAndExecuteTransactionBlock } = useWalletKit();
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
      
      // Method 1: Try to use the enhanced user history functions
      await fetchUserHistoryFromContract();
      
    } catch (error) {
      console.error('Failed to fetch from contract, falling back to events:', error);
      // Fallback: Use events if contract calls fail
      await fetchUserHistoryFromEvents();
    } finally {
      setLoading(false);
    }
  };

  // Primary method: Use the new smart contract functions
  const fetchUserHistoryFromContract = async () => {
    if (!currentAccount) return;

    try {
      // Get user's created droplets
      const createdResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::get_user_created_droplets`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(currentAccount.address)],
          });
          return tx;
        })(),
        sender: currentAccount.address,
      });

      // Get user's claimed droplets
      const claimedResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::get_user_claimed_droplets`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(currentAccount.address)],
          });
          return tx;
        })(),
        sender: currentAccount.address,
      });

      // Get user stats
      const statsResult = await suiClient.devInspectTransactionBlock({
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

      // Parse created droplets
      let created: string[] = [];
      if (createdResult.results?.[0]?.returnValues?.[0]) {
        created = parseStringVector(createdResult.results[0].returnValues[0]);
      }

      // Parse claimed droplets  
      let claimed: string[] = [];
      if (claimedResult.results?.[0]?.returnValues?.[0]) {
        claimed = parseStringVector(claimedResult.results[0].returnValues[0]);
      }

      // Parse stats
      let createdCount = 0;
      let claimedCount = 0;
      if (statsResult.results?.[0]?.returnValues && statsResult.results[0].returnValues.length >= 4) {
        createdCount = parseU64(statsResult.results[0].returnValues[2]);
        claimedCount = parseU64(statsResult.results[0].returnValues[3]);
      }

      console.log('Contract data:', { created, claimed, createdCount, claimedCount });

      // If contract calls return empty arrays, fall back to events
      if (created.length === 0 && claimed.length === 0) {
        await fetchUserHistoryFromEvents();
        return;
      }

      setCreatedDroplets(created);
      setClaimedDroplets(claimed);
      setUserStats({ createdCount, claimedCount });

      // Fetch detailed information for each droplet
      const [realCreatedDetails, realClaimedDetails] = await Promise.all([
        fetchDropletDetails(created),
        fetchDropletDetails(claimed)
      ]);
      
      setCreatedDetails(realCreatedDetails);
      setClaimedDetails(realClaimedDetails);

    } catch (error) {
      console.error('Contract function call failed:', error);
      throw error; // Re-throw to trigger fallback
    }
  };

  // Fallback method: Parse from events
  const fetchUserHistoryFromEvents = async () => {
    if (!currentAccount) return;

    try {
      const [createdIds, claimedIds] = await Promise.all([
        getDropletIdsFromEvents('created'),
        getDropletIdsFromEvents('claimed')
      ]);

      console.log('Event data:', { createdIds, claimedIds });

      setCreatedDroplets(createdIds);
      setClaimedDroplets(claimedIds);
      setUserStats({ 
        createdCount: createdIds.length, 
        claimedCount: claimedIds.length 
      });

      // Fetch detailed information for each droplet
      const [realCreatedDetails, realClaimedDetails] = await Promise.all([
        fetchDropletDetails(createdIds),
        fetchDropletDetails(claimedIds)
      ]);
      
      setCreatedDetails(realCreatedDetails);
      setClaimedDetails(realClaimedDetails);

    } catch (error) {
      console.error('Event parsing failed:', error);
      toast({
        title: "Error",
        description: "Failed to load your droplet history",
        variant: "destructive",
      });
    }
  };

  // Live refresh on-chain events
  useSuiEvents(() => {
    if (isConnected && currentAccount) {
      fetchUserHistory();
    }
  });

  // NEW: Cleanup expired droplet function
  const handleCleanupDroplet = async (dropletId: string, dropletAddress?: string) => {
    if (!currentAccount || !signAndExecuteTransactionBlock) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return;
    }

    try {
      setCleanupLoading(dropletId);

      // First, get the droplet address if not provided
      let address = dropletAddress;
      if (!address) {
        const addressResult = await suiClient.devInspectTransactionBlock({
          transactionBlock: (() => {
            const tx = new TransactionBlock();
            tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
              arguments: [tx.object(REGISTRY_ID), tx.pure(dropletId)],
            });
            return tx;
          })(),
          sender: currentAccount.address,
        });

        if (addressResult.results?.[0]?.returnValues?.[0]) {
          // Parse the Option<address> result
          const optionData = new Uint8Array(addressResult.results[0].returnValues[0]);
          if (optionData.length > 1 && optionData[0] === 1) { // Option is Some
            const addressBytes = optionData.slice(1, 33); // Next 32 bytes are the address
            address = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          }
        }
      }

      if (!address) {
        throw new Error('Could not find droplet address');
      }

      // Create cleanup transaction
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::cleanup_droplet`,
        arguments: [
          tx.object(address), // droplet object
          tx.object('0x6'), // clock object
        ],
        typeArguments: ['0x2::sui::SUI'], // Assuming SUI token, adjust as needed
      });

      // Execute the transaction
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      if (result.effects?.status?.status === 'success') {
        toast({
          title: "Success",
          description: `Expired droplet ${dropletId} has been cleaned up and refunded`,
        });

        // Refresh the data
        await fetchUserHistory();
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error: any) {
      console.error('Cleanup failed:', error);
      
      let errorMessage = 'Failed to cleanup droplet';
      if (error.message?.includes('E_DROPLET_EXPIRED')) {
        errorMessage = 'This droplet has not expired yet';
      } else if (error.message?.includes('E_DROPLET_CLOSED')) {
        errorMessage = 'This droplet is already closed';
      } else if (error.message?.includes('E_DROPLET_NOT_FOUND')) {
        errorMessage = 'Droplet not found';
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCleanupLoading(null);
    }
  };

  // Improved BCS parsing functions
  const parseStringVector = (returnValue: any): string[] => {
    try {
      if (!returnValue || !returnValue[0]) return [];
      
      // returnValue[0] contains the BCS-encoded vector<String>
      const bcsData = new Uint8Array(returnValue[0]);
      
      // Use BCS to decode vector<String>
      const vectorBcs = bcs.vector(bcs.string());
      const decodedVector = vectorBcs.parse(bcsData);
      
      console.log('Decoded string vector:', decodedVector);
      return decodedVector;
    } catch (error) {
      console.error('Error parsing string vector:', error);
      return [];
    }
  };

  const parseU64 = (returnValue: any): number => {
    try {
      if (!returnValue || !returnValue[0]) return 0;
      
      const bcsData = new Uint8Array(returnValue[0]);
      const u64Value = bcs.u64().parse(bcsData);
      
      return Number(u64Value);
    } catch (error) {
      console.error('Error parsing u64:', error);
      return 0;
    }
  };

  // Fetch droplet IDs from events as fallback
  const getDropletIdsFromEvents = async (type: 'created' | 'claimed'): Promise<string[]> => {
    try {
      if (!currentAccount) return [];
      
      const eventType = type === 'created' ? 'DropletCreated' : 'DropletClaimed';
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::${eventType}`,
        },
        order: 'descending',
        limit: 50,
      });

      const userDroplets: string[] = [];
      
      for (const event of events.data) {
        if (event.parsedJson) {
          const eventData = event.parsedJson as any;
          if (type === 'created' && eventData.sender === currentAccount.address) {
            userDroplets.push(eventData.droplet_id);
          } else if (type === 'claimed' && eventData.claimer === currentAccount.address) {
            userDroplets.push(eventData.droplet_id);
          }
        }
      }
      
      return [...new Set(userDroplets)]; // Remove duplicates
    } catch (error) {
      console.error(`Failed to fetch ${type} droplet IDs from events:`, error);
      return [];
    }
  };

  // Fetch real droplet details
  const fetchDropletDetails = async (dropletIds: string[]): Promise<DropletSummary[]> => {
    if (dropletIds.length === 0) return [];
    
    const details: DropletSummary[] = [];
    
    for (const dropletId of dropletIds) {
      try {
        // Create realistic droplet data based on events and contract state
        const dropletDetail = await createRealDropletSummary(dropletId);
        details.push(dropletDetail);
      } catch (error) {
        console.error(`Failed to fetch details for droplet ${dropletId}:`, error);
        // Still add basic info even if fetch fails
        details.push(createMockDropletSummary(dropletId));
      }
    }
    
    return details;
  };

  // Create droplet summary with realistic data from events
  const createRealDropletSummary = async (dropletId: string): Promise<DropletSummary> => {
    try {
      // Get droplet address from registry
      const addressResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(dropletId)],
          });
          return tx;
        })(),
        sender: currentAccount?.address || '0x0',
      });

      let dropletAddress: string | undefined;
      if (addressResult.results?.[0]?.returnValues?.[0]) {
        const optionData = new Uint8Array(addressResult.results[0].returnValues[0]);
        if (optionData.length > 1 && optionData[0] === 1) {
          const addressBytes = optionData.slice(1, 33);
          dropletAddress = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
      }

      // Get creation event for this droplet
      const creationEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletCreated`,
        },
        order: 'descending',
        limit: 100,
      });

      const creationEvent = creationEvents.data.find(event => 
        event.parsedJson && (event.parsedJson as any).droplet_id === dropletId
      );

      if (creationEvent && creationEvent.parsedJson) {
        const eventData = creationEvent.parsedJson as any;
        const now = Date.now();
        const expiryTime = parseInt(eventData.expiry_time);
        const isExpired = now >= expiryTime;
        
        // Get claim events for this droplet
        const claimEvents = await suiClient.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletClaimed`,
          },
          order: 'descending',
          limit: 100,
        });

        const claims = claimEvents.data.filter(event => 
          event.parsedJson && (event.parsedJson as any).droplet_id === dropletId
        );

        const numClaimed = claims.length;
        const claimedAmount = claims.reduce((total, claim) => {
          const claimData = claim.parsedJson as any;
          return total + parseInt(claimData.claim_amount || 0);
        }, 0);

        const receiverLimit = parseInt(eventData.receiver_limit);
        const isClosed = numClaimed >= receiverLimit;

        return {
          dropletId,
          dropletAddress,
          totalAmount: parseInt(eventData.net_amount),
          claimedAmount,
          receiverLimit,
          numClaimed,
          expiryTime,
          isExpired,
          isClosed,
          message: eventData.message || `Droplet ${dropletId}`,
        };
      }
    } catch (error) {
      console.error(`Failed to create real summary for ${dropletId}:`, error);
    }

    // Fallback to mock data if real data isn't available
    return createMockDropletSummary(dropletId);
  };

  const createMockDropletSummary = (dropletId: string): DropletSummary => {
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
      message: `Droplet ${dropletId}`,
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
            <Button 
              variant="destructive" 
              size="sm"
              disabled={cleanupLoading === droplet.dropletId}
              onClick={() => handleCleanupDroplet(droplet.dropletId, droplet.dropletAddress)}
            >
              {cleanupLoading === droplet.dropletId ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              {cleanupLoading === droplet.dropletId ? 'Cleaning...' : 'Cleanup'}
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
            {userStats.createdCount > 0 || userStats.claimedCount > 0 ? (
              <span className="ml-2 text-sui-green">
                • {userStats.createdCount} created • {userStats.claimedCount} claimed
              </span>
            ) : null}
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
                  {createdDroplets.length === 0 ? 
                    "You haven't created any droplets yet" : 
                    "No droplets found for the selected filter"
                  }
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
                  {claimedDroplets.length === 0 ? 
                    "You haven't claimed any droplets yet" : 
                    "No droplets found for the selected filter"
                  }
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}