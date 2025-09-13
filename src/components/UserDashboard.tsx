import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE } from '@/lib/suiClient';
import { Skeleton } from '@/components/ui/skeleton';
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
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
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
  const [createdPage, setCreatedPage] = useState(1);
  const [claimedPage, setClaimedPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const { toast } = useToast();

  // Efficient event processing and caching
  interface EventCache {
    lastFetchTime: number;
    cursor: string | null;
  }

  const EVENT_CACHE_DURATION = 30000; // 30 seconds
  const eventCache: EventCache = {
    lastFetchTime: 0,
    cursor: null
  };

  // In-memory refs for larger caches to avoid re-creating on render
  const createdEventsRef = useRef<any[]>([]);
  const claimedEventsRef = useRef<any[]>([]);
  const closedEventsRef = useRef<any[]>([]);
  const dropletAddressRef = useRef<Map<string, string>>(new Map());

  // Batch fetch all relevant events once and progressively load details
  const fetchUserActivity = async () => {
    if (!currentAccount?.address) return;

    setLoading(true);
    try {
      const now = Date.now();

      // If cache is fresh, reuse refs
      if (now - eventCache.lastFetchTime < EVENT_CACHE_DURATION && createdEventsRef.current.length) {
        // build from cached refs
      } else {
        // Fetch each event type once (larger limit to minimize repeated calls)
        const [createdRes, claimedRes, closedRes] = await Promise.all([
          suiClient.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletCreated` }, order: 'descending', limit: 1000 }),
          suiClient.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletClaimed` }, order: 'descending', limit: 1000 }),
          suiClient.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletClosed` }, order: 'descending', limit: 1000 }),
        ]);

        createdEventsRef.current = createdRes.data || [];
        claimedEventsRef.current = claimedRes.data || [];
        closedEventsRef.current = closedRes.data || [];

        eventCache.lastFetchTime = now;
        eventCache.cursor = createdRes.hasNextPage ? createdRes.nextCursor : null;
      }

      // Build droplet ID sets from events (fast in-memory work)
      const createdSet = new Set<string>();
      const claimedSet = new Set<string>();

      for (const ev of createdEventsRef.current) {
        const p = ev.parsedJson as any;
        if (p?.droplet_id && p?.sender === currentAccount.address) createdSet.add(p.droplet_id);
      }

      for (const ev of claimedEventsRef.current) {
        const p = ev.parsedJson as any;
        if (p?.droplet_id && p?.claimer === currentAccount.address) claimedSet.add(p.droplet_id);
      }

      const createdIds = Array.from(createdSet);
      const claimedIds = Array.from(claimedSet);

      // Update quick stats and lists immediately so UI can render skeletons
      setUserStats({ createdCount: createdIds.length, claimedCount: claimedIds.length });
      setCreatedDroplets(createdIds);
      setClaimedDroplets(claimedIds);

      // Start progressive details loading: show placeholders then fill visible page items first
      // Render placeholders immediately
      setCreatedDetails(createdIds.map(id => ({ dropletId: id, totalAmount: 0, claimedAmount: 0, receiverLimit: 0, numClaimed: 0, expiryTime: 0, isExpired: false, isClosed: false, message: 'Loading...' })));
      setClaimedDetails(claimedIds.map(id => ({ dropletId: id, totalAmount: 0, claimedAmount: 0, receiverLimit: 0, numClaimed: 0, expiryTime: 0, isExpired: false, isClosed: false, message: 'Loading...' })));

      // Fetch details for first visible pages first
      const visibleCreated = createdIds.slice((createdPage - 1) * ITEMS_PER_PAGE, createdPage * ITEMS_PER_PAGE);
      const visibleClaimed = claimedIds.slice((claimedPage - 1) * ITEMS_PER_PAGE, claimedPage * ITEMS_PER_PAGE);

      // Fetch these in parallel but limited concurrency via simple limiter
      await Promise.all([
        fetchDropletDetailsInBatches(visibleCreated, setCreatedDetails, 5),
        fetchDropletDetailsInBatches(visibleClaimed, setClaimedDetails, 5),
      ]);

      // Then fetch remaining items in background (don't await to keep UI snappy)
      (async () => {
        const remainingCreated = createdIds.filter(id => !visibleCreated.includes(id));
        const remainingClaimed = claimedIds.filter(id => !visibleClaimed.includes(id));

        await Promise.all([
          fetchDropletDetailsInBatches(remainingCreated, setCreatedDetails, 10),
          fetchDropletDetailsInBatches(remainingClaimed, setClaimedDetails, 10),
        ]);
      })();

    } catch (e) {
      console.error('fetchUserActivity error', e);
      toast({ title: 'Error', description: 'Failed to load activity', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Fallback method using events
  const fetchUserHistoryFromEvents = async () => {
    if (!currentAccount?.address) return;

    try {
      // Fetch created events
      const createdEventsResult = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletCreated`
        },
        order: 'ascending'
      });

      // Fetch claimed events  
      const claimedEventsResult = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletClaimed`
        },
        order: 'ascending'
      });

      // Filter events by current user
      const userCreatedEvents = createdEventsResult.data.filter(event => 
        event.parsedJson && 
        (event.parsedJson as any).sender === currentAccount.address
      );

      const userClaimedEvents = claimedEventsResult.data.filter(event =>
        event.parsedJson &&
        (event.parsedJson as any).claimer === currentAccount.address
      );

      // Extract droplet IDs
      const createdIds = userCreatedEvents.map(event => 
        (event.parsedJson as any).droplet_id
      );

      const claimedIds = userClaimedEvents.map(event =>
        (event.parsedJson as any).droplet_id
      );

      setCreatedDroplets(createdIds);
      setClaimedDroplets(claimedIds);
      setUserStats({
        createdCount: createdIds.length,
        claimedCount: claimedIds.length
      });

      // Fetch details for each droplet
      await Promise.all([
        fetchDropletDetailsInBatches(createdIds, setCreatedDetails),
        fetchDropletDetailsInBatches(claimedIds, setClaimedDetails)
      ]);

    } catch (error) {
      console.error('Error fetching user history from events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user history",
        variant: "destructive",
      });
    }
  };

  // Process events efficiently in memory
  const processUserEvents = (events: any[], userAddress: string) => {
    const result = {
      created: new Set<string>(),
      claimed: new Set<string>(),
      stats: { createdCount: 0, claimedCount: 0 },
      eventsByDroplet: new Map()
    };

    // Single pass through events to group by droplet and type
    events.forEach(event => {
      const parsedJson = event.parsedJson;
      if (!parsedJson) return;

      const dropletId = parsedJson.droplet_id;
      if (!dropletId) return;

      // Group events by droplet ID for efficient lookup
      if (!result.eventsByDroplet.has(dropletId)) {
        result.eventsByDroplet.set(dropletId, []);
      }
      result.eventsByDroplet.get(dropletId)?.push(event);

      // Track user's created and claimed droplets
      if (event.type.includes('DropletCreated') && parsedJson.sender === userAddress) {
        result.created.add(dropletId);
        result.stats.createdCount++;
      } else if (event.type.includes('DropletClaimed') && parsedJson.claimer === userAddress) {
        result.claimed.add(dropletId);
        result.stats.claimedCount++;
      }
    });

    return {
      ...result,
      created: Array.from(result.created),
      claimed: Array.from(result.claimed)
    };
  };

  // Fetch droplet details progressively with concurrency control
  const fetchDropletDetailsInBatches = async (
    dropletIds: string[],
    setSummaries: Dispatch<SetStateAction<DropletSummary[]>>,
    batchSize = 5
  ) => {
    if (!dropletIds || dropletIds.length === 0) return [];

    // Ensure placeholders exist (append so we don't block render)
    setSummaries(prev => {
      const existingIds = new Set(prev.map(p => p.dropletId));
      const toAdd = dropletIds.filter(id => !existingIds.has(id)).map(id => ({
        dropletId: id,
        totalAmount: 0,
        claimedAmount: 0,
        receiverLimit: 0,
        numClaimed: 0,
        expiryTime: 0,
        isExpired: false,
        isClosed: false,
        message: 'Loading...',
      }));
      return [...prev, ...toAdd];
    });

    const results: DropletSummary[] = [];

    // Helper: process chunk of dropletIds concurrently
    const processChunk = async (chunk: string[]) => {
      await Promise.all(chunk.map(async (dropletId) => {
        try {
          const summary = await createDropletSummaryFromEvents(dropletId);
          if (summary) {
            results.push(summary);
            // update state immediately for this droplet
            setSummaries(prev => prev.map(p => p.dropletId === summary.dropletId ? summary : p));
          }
        } catch (err) {
          console.error('detail fetch error', dropletId, err);
        }
      }));
    };

    // Break into chunks of batchSize and run sequentially to limit RPC
    for (let i = 0; i < dropletIds.length; i += batchSize) {
      const chunk = dropletIds.slice(i, i + batchSize);
      // Start chunk and wait to avoid too many parallel requests
      // but allow within-chunk parallelism
      // eslint-disable-next-line no-await-in-loop
      await processChunk(chunk);
    }

    return results;
  };

  // Create droplet summary from cached events (fast) and fallback to on-chain introspection when needed
  const createDropletSummaryFromEvents = async (dropletId: string): Promise<DropletSummary | null> => {
    try {
      // Find creation event in cached refs
      const creationEvent = createdEventsRef.current.find(ev => ev.parsedJson && (ev.parsedJson as any).droplet_id === dropletId);
      if (!creationEvent || !creationEvent.parsedJson) return null;

      const eventData = creationEvent.parsedJson as any;

      // Use cached claim events to compute claimed counts and amounts
      const claimEventsForDroplet = claimedEventsRef.current.filter(ev => ev.parsedJson && (ev.parsedJson as any).droplet_id === dropletId);
      const numClaimed = claimEventsForDroplet.length;
      const claimedAmount = claimEventsForDroplet.reduce((sum, ev) => sum + parseInt((ev.parsedJson as any).claim_amount || '0'), 0);

      // Check closed events cache
      const closedEvent = closedEventsRef.current.find(ev => ev.parsedJson && (ev.parsedJson as any).droplet_id === dropletId);

      // Resolve or reuse droplet address
      let dropletAddress = dropletAddressRef.current.get(dropletId);
      if (!dropletAddress) {
        // Dev-inspect once and cache
        const tx = new TransactionBlock();
        tx.moveCall({ target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`, arguments: [tx.object(REGISTRY_ID), tx.pure.string(dropletId)] });
        try {
          const addressResult = await suiClient.devInspectTransactionBlock({ transactionBlock: tx as any, sender: currentAccount?.address || '0x0' });
          if (addressResult.results?.[0]?.returnValues?.[0]) {
            const optionData = addressResult.results[0].returnValues[0][0];
            if (optionData && optionData.length > 1 && optionData[0] === 1) {
              const addressBytes = optionData.slice(1, 33);
              dropletAddress = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');
              dropletAddressRef.current.set(dropletId, dropletAddress);
            }
          }
        } catch (e) {
          // non-fatal: address may be missing from registry or call failed
          console.warn('devInspect find_droplet_by_id failed for', dropletId, e);
        }
      }

      const now = Date.now();
      const expiryTime = parseInt(eventData.expiry_time || '0');
      const isExpired = now >= expiryTime;

      const summary: DropletSummary = {
        dropletId,
        dropletAddress,
        totalAmount: parseInt(eventData.net_amount || eventData.total_amount || '0'),
        claimedAmount,
        receiverLimit: parseInt(eventData.receiver_limit || '0'),
        numClaimed,
        expiryTime,
        isExpired,
        isClosed: !!closedEvent,
        message: eventData.message || '',
      };

      return summary;
    } catch (error) {
      console.error(`Error creating summary for droplet ${dropletId}:`, error);
      return null;
    }
  };

  // Cleanup expired droplet
  const handleCleanupDroplet = async (dropletId: string) => {
    if (!currentAccount?.address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to cleanup droplets",
        variant: "destructive"
      });
      return;
    }

    try {
      // Start loading state
      setCleanupLoading(dropletId);

      // Optimistically update the UI
      setCreatedDetails(prevDetails => 
        prevDetails.map(detail => 
          detail.dropletId === dropletId 
            ? { ...detail, isClosed: true }
            : detail
        )
      );

      // Find droplet address first
      let address: string | undefined;
      const dropletSummary = createdDetails.find(d => d.dropletId === dropletId);
      
      if (dropletSummary?.dropletAddress) {
        address = dropletSummary.dropletAddress;
      } else {
        // Fetch address from contract
        const tx = new TransactionBlock();
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
          arguments: [tx.object(REGISTRY_ID), tx.pure.string(dropletId)],
        });

        const addressResult = await suiClient.devInspectTransactionBlock({
          transactionBlock: tx as any,
          sender: currentAccount.address,
        });

        if (addressResult.results?.[0]?.returnValues?.[0]) {
          // Parse the Option<address> result
          const optionData = addressResult.results[0].returnValues[0][0];
          if (optionData && optionData.length > 1 && optionData[0] === 1) { // Option is Some
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
      signAndExecuteTransaction(
        {
          transaction: tx as any,
        },
        {
          onSuccess: (result) => {
            if (result.effects) {
              // Clear cache to ensure fresh data on next fetch
              eventCache.lastFetchTime = 0;
              
              toast({
                title: "Success",
                description: `Expired droplet ${dropletId} has been cleaned up and refunded`,
              });
            } else {
              toast({
                title: "Error", 
                description: "Transaction failed",
                variant: "destructive",
              });
            }
            setCleanupLoading(null);
          },
          onError: (error: any) => {
            console.error('Cleanup failed:', error);
            
            let errorMessage = 'Failed to cleanup droplet';
            if (error.message?.includes('E_DROPLET_EXPIRED')) {
              errorMessage = 'This droplet has not expired yet';
            } else if (error.message?.includes('E_DROPLET_CLOSED')) {
              errorMessage = 'This droplet is already closed';
            } else if (error.message?.includes('E_DROPLET_NOT_FOUND')) {
              errorMessage = 'Droplet not found';
            }

            // Revert the optimistic update
            setCreatedDetails(prevDetails => 
              prevDetails.map(detail => 
                detail.dropletId === dropletId 
                  ? { ...detail, isClosed: false }
                  : detail
              )
            );

            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
            setCleanupLoading(null);
          }
        }
      );

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
      setCleanupLoading(null);
    }
  };

  // Filter functions
  const filterDroplets = (droplets: DropletSummary[], filter: FilterType): DropletSummary[] => {
    const now = Date.now();
    
    switch (filter) {
      case 'active':
        return droplets.filter(d => !d.isExpired && !d.isClosed && d.numClaimed < d.receiverLimit);
      case 'expired':
        return droplets.filter(d => d.isExpired && !d.isClosed);
      case 'completed':
        return droplets.filter(d => d.isClosed || d.numClaimed >= d.receiverLimit);
      default:
        return droplets;
    }
  };

  const filteredCreated = filterDroplets(createdDetails, createdFilter);
  const filteredClaimed = filterDroplets(claimedDetails, claimedFilter);

  // Auto-refresh mechanism
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const refreshData = async () => {
      if (currentAccount?.address) {
        await fetchUserActivity();
      }
    };

    if (currentAccount?.address) {
      // Initial load
      refreshData();

      // Fallback polling every 60 seconds (keeps load low)
      intervalId = setInterval(refreshData, 60000);
    } else {
      // Reset state when disconnected
      setCreatedDroplets([]);
      setClaimedDroplets([]);
      setCreatedDetails([]);
      setClaimedDetails([]);
      setUserStats({ createdCount: 0, claimedCount: 0 });
      setLoading(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentAccount?.address, createdPage, claimedPage]);

  if (!currentAccount) {
    return (
      <GradientCard variant="glow" className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
            <User className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
          <CardDescription>
            Connect your wallet to view your droplet activity and manage your airdrops
          </CardDescription>
        </CardHeader>
      </GradientCard>
    );
  }

  // Skeleton loader for droplet cards
  const DropletCardSkeleton = () => (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <GradientCard variant="glow" className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="created" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="created" className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Created (...)
                </TabsTrigger>
                <TabsTrigger value="claimed" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Claimed (...)
                </TabsTrigger>
              </TabsList>
              <div className="mt-4 space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <DropletCardSkeleton key={i} />
                ))}
              </div>
            </Tabs>
          </CardContent>
        </GradientCard>
      </div>
    );
  }

  const renderDroplet = (droplet: DropletSummary, showCleanup = false) => (
    <div
      key={droplet.dropletId}
      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center space-x-4">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
          {showCleanup ? (
            <Send className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Gift className="h-5 w-5 text-primary-foreground" />
          )}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{droplet.dropletId}</span>
            <Badge 
              variant={
                droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                  ? 'secondary'
                  : droplet.isExpired
                  ? 'destructive'
                  : 'default'
              }
              className="text-xs"
            >
              {droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                ? 'Completed'
                : droplet.isExpired
                ? 'Expired'
                : 'Active'
              }
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>{droplet.numClaimed}/{droplet.receiverLimit} claimed</span>
            <span>{(droplet.totalAmount / 1000000000).toFixed(2)} SUI</span>
            {showCleanup && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {droplet.isExpired 
                    ? 'Expired' 
                    : `${Math.ceil((droplet.expiryTime - Date.now()) / (1000 * 60 * 60))}h left`
                  }
                </span>
              </div>
            )}
          </div>

          {droplet.message && (
            <p className="text-sm text-muted-foreground truncate max-w-xs">
              "{droplet.message}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDroplet(droplet.dropletId)}
          className="flex items-center gap-1"
        >
          <Eye className="h-4 w-4" />
          View
        </Button>

        {showCleanup && droplet.isExpired && !droplet.isClosed && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleCleanupDroplet(droplet.dropletId)}
            disabled={cleanupLoading === droplet.dropletId}
            className="flex items-center gap-1"
          >
            {cleanupLoading === droplet.dropletId ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Cleanup
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <GradientCard variant="glow" className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <CardTitle>Your Dashboard</CardTitle>
          </div>
          <CardDescription>
            Manage your created airdrops and view your claiming history
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="created" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="created" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Created ({userStats.createdCount})
              </TabsTrigger>
              <TabsTrigger value="claimed" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Claimed ({userStats.claimedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="created" className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-2">
                    {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                      <Button
                        key={filter}
                        variant={createdFilter === filter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setCreatedFilter(filter);
                          setCreatedPage(1);
                        }}
                        className="capitalize"
                      >
                        {filter}
                      </Button>
                    ))}
                  </div>
                </div>
                {filteredCreated.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Showing {Math.min(ITEMS_PER_PAGE, filteredCreated.length - (createdPage - 1) * ITEMS_PER_PAGE)} of {filteredCreated.length}
                  </span>
                )}
              </div>

              {filteredCreated.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No droplets found</h3>
                  <p className="text-sm text-muted-foreground">
                    {createdFilter === 'all' 
                      ? "You haven't created any droplets yet"
                      : `No ${createdFilter} droplets found`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {filteredCreated
                      .slice((createdPage - 1) * ITEMS_PER_PAGE, createdPage * ITEMS_PER_PAGE)
                      .map((droplet) => (
                    <div
                      key={droplet.dropletId}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                          <Send className="h-5 w-5 text-primary-foreground" />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{droplet.dropletId}</span>
                            <Badge 
                              variant={
                                droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                                  ? 'secondary'
                                  : droplet.isExpired
                                  ? 'destructive'
                                  : 'default'
                              }
                              className="text-xs"
                            >
                              {droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                                ? 'Completed'
                                : droplet.isExpired
                                ? 'Expired'
                                : 'Active'
                              }
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>{droplet.numClaimed}/{droplet.receiverLimit} claimed</span>
                            <span>{(droplet.totalAmount / 1000000000).toFixed(2)} SUI</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {droplet.isExpired 
                                  ? 'Expired' 
                                  : `${Math.ceil((droplet.expiryTime - Date.now()) / (1000 * 60 * 60))}h left`
                                }
                              </span>
                            </div>
                          </div>

                          {droplet.message && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              "{droplet.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDroplet(droplet.dropletId)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>

                        {droplet.isExpired && !droplet.isClosed && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCleanupDroplet(droplet.dropletId)}
                            disabled={cleanupLoading === droplet.dropletId}
                            className="flex items-center gap-1"
                          >
                            {cleanupLoading === droplet.dropletId ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cleaning...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4" />
                                Cleanup
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                  {filteredCreated.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button size="sm" variant="ghost" disabled={createdPage <= 1} onClick={() => setCreatedPage(p => Math.max(1, p - 1))}>
                        Prev
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {createdPage} of {Math.ceil(filteredCreated.length / ITEMS_PER_PAGE)}</span>
                      <Button size="sm" variant="ghost" disabled={createdPage >= Math.ceil(filteredCreated.length / ITEMS_PER_PAGE)} onClick={() => setCreatedPage(p => Math.min(Math.ceil(filteredCreated.length / ITEMS_PER_PAGE), p + 1))}>
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Claimed Droplets Tab */}
            <TabsContent value="claimed" className="space-y-4">
              {/* Filter buttons */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-2">
                    {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                      <Button
                        key={filter}
                        variant={claimedFilter === filter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setClaimedFilter(filter);
                          setClaimedPage(1);
                        }}
                        className="capitalize"
                      >
                        {filter}
                      </Button>
                    ))}
                  </div>
                </div>
                {filteredClaimed.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Showing {Math.min(ITEMS_PER_PAGE, filteredClaimed.length - (claimedPage - 1) * ITEMS_PER_PAGE)} of {filteredClaimed.length}
                  </span>
                )}
              </div>

              {filteredClaimed.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No claims found</h3>
                  <p className="text-sm text-muted-foreground">
                    {claimedFilter === 'all' 
                      ? "You haven't claimed from any droplets yet"
                      : `No ${claimedFilter} claims found`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {filteredClaimed
                      .slice((claimedPage - 1) * ITEMS_PER_PAGE, claimedPage * ITEMS_PER_PAGE)
                      .map((droplet) => (
                    <div
                      key={droplet.dropletId}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                          <Gift className="h-5 w-5 text-primary-foreground" />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{droplet.dropletId}</span>
                            <Badge 
                              variant={
                                droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                                  ? 'secondary'
                                  : droplet.isExpired
                                  ? 'destructive'
                                  : 'default'
                              }
                              className="text-xs"
                            >
                              {droplet.isClosed || droplet.numClaimed >= droplet.receiverLimit
                                ? 'Completed'
                                : droplet.isExpired
                                ? 'Expired'
                                : 'Active'
                              }
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>{droplet.numClaimed}/{droplet.receiverLimit} claimed</span>
                            <span>{(droplet.totalAmount / 1000000000).toFixed(2)} SUI</span>
                          </div>

                          {droplet.message && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              "{droplet.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDroplet(droplet.dropletId)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))}
                  </div>
                  {filteredClaimed.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button size="sm" variant="ghost" disabled={claimedPage <= 1} onClick={() => setClaimedPage(p => Math.max(1, p - 1))}>
                        Prev
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {claimedPage} of {Math.ceil(filteredClaimed.length / ITEMS_PER_PAGE)}</span>
                      <Button size="sm" variant="ghost" disabled={claimedPage >= Math.ceil(filteredClaimed.length / ITEMS_PER_PAGE)} onClick={() => setClaimedPage(p => Math.min(Math.ceil(filteredClaimed.length / ITEMS_PER_PAGE), p + 1))}>
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </GradientCard>

      {/* Droplet Details Modal */}
      {selectedDroplet && (
        <DropletDetails
          dropletId={selectedDroplet}
          onClose={() => setSelectedDroplet(null)}
        />
      )}
    </div>
  );
}