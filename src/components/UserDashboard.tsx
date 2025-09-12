import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
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
  const { toast } = useToast();

  // Fetch user activity from smart contract
  const fetchUserActivity = async () => {
    if (!currentAccount?.address) return;

    try {
      setLoading(true);

      // Create transaction to get user activity
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::get_user_activity_summary`,
        arguments: [tx.object(REGISTRY_ID), tx.pure.address(currentAccount.address)],
      });

      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: tx as any,
        sender: currentAccount.address,
      });

      // Parse the return values - simplified approach
      const returnValues = result.results?.[0]?.returnValues;
      if (returnValues && returnValues.length >= 4) {
        // Get counts from the contract (these are u64 values)
        const createdCount = returnValues[2] ? parseInt(returnValues[2][1]) : 0;
        const claimedCount = returnValues[3] ? parseInt(returnValues[3][1]) : 0;
        
        setUserStats({ createdCount, claimedCount });
      }

      // Fallback to using events for droplet IDs
      await fetchUserHistoryFromEvents();

    } catch (error) {
      console.error('Error fetching user activity:', error);
      await fetchUserHistoryFromEvents(); // Fallback to events
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
        fetchDropletDetails(createdIds, setCreatedDetails),
        fetchDropletDetails(claimedIds, setClaimedDetails)
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

  // Fetch droplet details
  const fetchDropletDetails = async (dropletIds: string[], setSummaries: (summaries: DropletSummary[]) => void) => {
    const summaries: DropletSummary[] = [];

    for (const dropletId of dropletIds) {
      try {
        const summary = await createDropletSummaryFromEvents(dropletId);
        if (summary) {
          summaries.push(summary);
        }
      } catch (error) {
        console.error(`Error fetching details for droplet ${dropletId}:`, error);
      }
    }

    setSummaries(summaries);
  };

  // Create droplet summary from events
  const createDropletSummaryFromEvents = async (dropletId: string): Promise<DropletSummary | null> => {
    try {
      // Get droplet address
        const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
        arguments: [tx.object(REGISTRY_ID), tx.pure.string(dropletId)],
      });

      const addressResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: tx as any,
        sender: currentAccount?.address || '0x0',
      });

      let dropletAddress: string | undefined;
      if (addressResult.results?.[0]?.returnValues?.[0]) {
        const optionData = addressResult.results[0].returnValues[0][0];
        if (optionData && optionData.length > 1 && optionData[0] === 1) {
          const addressBytes = optionData.slice(1, 33);
          dropletAddress = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
      }

      // Get creation event for this droplet
      const creationEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletCreated`
        },
      });

      const creationEvent = creationEvents.data.find(event => 
        event.parsedJson && (event.parsedJson as any).droplet_id === dropletId
      );

      if (!creationEvent || !creationEvent.parsedJson) {
        return null;
      }

      const eventData = creationEvent.parsedJson as any;

      // Get claim events for this droplet
      const claimEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE}::DropletClaimed`
        },
      });

      const claimEventsForDroplet = claimEvents.data.filter(event =>
        event.parsedJson && (event.parsedJson as any).droplet_id === dropletId
      );

      const totalClaimed = claimEventsForDroplet.reduce((sum, event) => {
        return sum + parseInt((event.parsedJson as any).claim_amount || '0');
      }, 0);

      const currentTime = Date.now();
      const expiryTime = parseInt(eventData.expiry_time);
      const isExpired = currentTime >= expiryTime;

      return {
        dropletId,
        dropletAddress,
        totalAmount: parseInt(eventData.net_amount || eventData.total_amount),
        claimedAmount: totalClaimed,
        receiverLimit: parseInt(eventData.receiver_limit),
        numClaimed: claimEventsForDroplet.length,
        expiryTime,
        isExpired,
        isClosed: false, // We'd need to check the object state for this
        message: eventData.message || '',
      };

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
      setCleanupLoading(dropletId);

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
              toast({
                title: "Success",
                description: `Expired droplet ${dropletId} has been cleaned up and refunded`,
              });

              // Refresh the data
              fetchUserActivity();
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

  // Load data on mount and account change
  useEffect(() => {
    if (currentAccount?.address) {
      fetchUserActivity();
    } else {
      setCreatedDroplets([]);
      setClaimedDroplets([]);
      setCreatedDetails([]);
      setClaimedDetails([]);
      setUserStats({ createdCount: 0, claimedCount: 0 });
      setLoading(false);
    }
  }, [currentAccount?.address]);

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

  if (loading) {
    return (
      <GradientCard variant="glow" className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading your dashboard...</span>
          </div>
        </CardContent>
      </GradientCard>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
     
        
        

       

      {/* Main Dashboard */}
      <GradientCard variant="glow" className="w-full">
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

            {/* Created Droplets Tab */}
            <TabsContent value="created" className="space-y-4">
              {/* Filter buttons */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-2">
                  {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                    <Button
                      key={filter}
                      variant={createdFilter === filter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCreatedFilter(filter)}
                      className="capitalize"
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {filteredCreated.map((droplet) => (
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
              )}
            </TabsContent>

            {/* Claimed Droplets Tab */}
            <TabsContent value="claimed" className="space-y-4">
              {/* Filter buttons */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-2">
                  {(['all', 'active', 'expired', 'completed'] as FilterType[]).map((filter) => (
                    <Button
                      key={filter}
                      variant={claimedFilter === filter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setClaimedFilter(filter)}
                      className="capitalize"
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {filteredClaimed.map((droplet) => (
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