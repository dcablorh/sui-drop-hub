import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, CLOCK_ID } from '@/lib/suiClient';
import { 
  Clock, 
  Users, 
  Coins, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Copy,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DropletDetailsProps {
  dropletId: string;
  onClose?: () => void;
}

interface DropletInfo {
  dropletId: string;
  sender: string;
  totalAmount: number;
  claimedAmount: number;
  remainingAmount: number;
  receiverLimit: number;
  numClaimed: number;
  createdAt: number;
  expiryTime: number;
  isExpired: boolean;
  isClosed: boolean;
  message: string;
  claimers: string[];
  claimerNames: string[];
}

export function DropletDetails({ dropletId, onClose }: DropletDetailsProps) {
  const [dropletInfo, setDropletInfo] = useState<DropletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [hasClaimed, setHasClaimed] = useState(false);
  const { currentAccount } = useWalletKit();
  const { toast } = useToast();

  useEffect(() => {
    fetchDropletInfo();
  }, [dropletId]);

  useEffect(() => {
    if (dropletInfo && !dropletInfo.isExpired) {
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [dropletInfo]);

  const fetchDropletInfo = async () => {
    try {
      // First get droplet address
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

      if (!addressResult.results?.[0]?.returnValues?.[0]) {
        throw new Error('Droplet not found');
      }

      // Parse the Option<address> return value
      const returnValue = addressResult.results[0].returnValues[0];
      const bytes = returnValue[0] as number[];
      
      if (bytes.length === 1 && bytes[0] === 0) {
        throw new Error('Droplet not found');
      }

      // Extract address from Some(address)
      const addressBytes = bytes.slice(1);
      const dropletAddress = '0x' + Array.from(addressBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Get droplet object
      const dropletObject = await suiClient.getObject({
        id: dropletAddress,
        options: { showContent: true }
      });

      if (!dropletObject.data?.content || dropletObject.data.content.dataType !== 'moveObject') {
        throw new Error('Invalid droplet object');
      }

      const fields = (dropletObject.data.content as any).fields;

      // Get droplet info
      const infoResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::get_droplet_info`,
            typeArguments: ['0x2::sui::SUI'],
            arguments: [tx.object(dropletAddress), tx.object(CLOCK_ID)],
          });
          return tx;
        })(),
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

      if (infoResult.results?.[0]?.returnValues) {
        const values = infoResult.results[0].returnValues;
        
        const info: DropletInfo = {
          dropletId: fields.droplet_id,
          sender: fields.sender,
          totalAmount: parseInt(fields.total_amount),
          claimedAmount: parseInt(fields.claimed_amount),
          remainingAmount: parseInt(values[3]?.[0] ? Buffer.from(values[3][0]).readBigUInt64LE().toString() : '0'),
          receiverLimit: parseInt(fields.receiver_limit),
          numClaimed: parseInt(fields.num_claimed),
          createdAt: parseInt(fields.created_at),
          expiryTime: parseInt(fields.expiry_time),
          isExpired: values[7]?.[0] ? (values[7][0] as number[])[0] === 1 : false,
          isClosed: fields.is_closed,
          message: fields.message,
          claimers: fields.claimers_list || [],
          claimerNames: fields.claimer_names || [],
        };

        setDropletInfo(info);

        // Check if current user has claimed
        if (currentAccount) {
          const hasClaimedResult = await suiClient.devInspectTransactionBlock({
            transactionBlock: (() => {
              const tx = new TransactionBlock();
              tx.moveCall({
                target: `${PACKAGE_ID}::${MODULE}::has_claimed`,
                typeArguments: ['0x2::sui::SUI'],
                arguments: [tx.object(dropletAddress), tx.pure(currentAccount.address)],
              });
              return tx;
            })(),
            sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
          });

          if (hasClaimedResult.results?.[0]?.returnValues?.[0]) {
            const claimedBytes = hasClaimedResult.results[0].returnValues[0][0] as number[];
            setHasClaimed(claimedBytes[0] === 1);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch droplet info:', error);
      toast({
        title: "Error",
        description: "Failed to load droplet details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (!dropletInfo) return;

    const now = Date.now();
    const timeRemaining = dropletInfo.expiryTime - now;

    if (timeRemaining <= 0) {
      setTimeLeft('Expired');
      return;
    }

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  const getStatusBadge = () => {
    if (dropletInfo?.isClosed) {
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Closed</Badge>;
    }
    if (dropletInfo?.isExpired) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    return <Badge variant="default" className="bg-sui-green/20 text-sui-green border-sui-green/30">
      <CheckCircle className="h-3 w-3 mr-1" />Active
    </Badge>;
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
              <div className="h-16 bg-secondary/50 rounded"></div>
            </div>
          </div>
        </CardContent>
      </GradientCard>
    );
  }

  if (!dropletInfo) {
    return (
      <GradientCard className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Droplet Not Found</h3>
          <p className="text-muted-foreground">The requested droplet could not be found.</p>
        </CardContent>
      </GradientCard>
    );
  }

  const progress = (dropletInfo.numClaimed / dropletInfo.receiverLimit) * 100;

  return (
    <GradientCard className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl">Droplet Details</CardTitle>
            {getStatusBadge()}
            {hasClaimed && (
              <Badge variant="outline" className="text-sui-blue border-sui-blue/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                You Claimed
              </Badge>
            )}
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Droplet ID</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-lg font-mono bg-secondary/50 px-2 py-1 rounded">
                  {dropletInfo.dropletId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(dropletInfo.dropletId)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Creator</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono bg-secondary/50 px-2 py-1 rounded">
                  {dropletInfo.sender.slice(0, 6)}...{dropletInfo.sender.slice(-4)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(dropletInfo.sender)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {dropletInfo.message && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Message</label>
                <p className="mt-1 text-sm bg-secondary/50 p-3 rounded">{dropletInfo.message}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
                <p className="text-lg font-semibold">{(dropletInfo.totalAmount / 1e9).toFixed(4)} SUI</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Remaining</label>
                <p className="text-lg font-semibold text-sui-green">
                  {(dropletInfo.remainingAmount / 1e9).toFixed(4)} SUI
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Time Remaining</label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{timeLeft}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Claims Progress
            </label>
            <span className="text-sm text-muted-foreground">
              {dropletInfo.numClaimed} / {dropletInfo.receiverLimit}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {dropletInfo.receiverLimit - dropletInfo.numClaimed} spots remaining
          </p>
        </div>

        {/* Claimers List */}
        {dropletInfo.claimers.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Claimers ({dropletInfo.claimers.length})
            </h4>
            <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg">
              {dropletInfo.claimers.map((claimer, index) => (
                <div
                  key={claimer}
                  className="flex items-center justify-between p-3 border-b border-border/30 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{dropletInfo.claimerNames[index]}</p>
                      <code className="text-xs text-muted-foreground">
                        {claimer.slice(0, 6)}...{claimer.slice(-4)}
                      </code>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-sui-green">
                    {((dropletInfo.totalAmount / dropletInfo.receiverLimit) / 1e9).toFixed(4)} SUI
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </GradientCard>
  );
}