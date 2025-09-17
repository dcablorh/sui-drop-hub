import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, CLOCK_ID, handleTransactionError } from '@/lib/suiClient';
import { RefreshCw, Hash } from 'lucide-react';

export const CleanupDroplet = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dropletId, setDropletId] = useState('');
  const [error, setError] = useState('');

  const validateDropletId = (id: string) => {
    const dropletIdRegex = /^[A-Z0-9]{6}$/;
    if (!id) {
      return 'Droplet ID is required';
    }
    if (!dropletIdRegex.test(id)) {
      return 'Droplet ID must be exactly 6 uppercase alphanumeric characters';
    }
    return '';
  };

  const handleCleanup = async () => {
    if (!currentAccount) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to cleanup a droplet",
        variant: "destructive"
      });
      return;
    }

    const validationError = validateDropletId(dropletId);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');

    try {
      setLoading(true);
      
      // First, get the droplet address by ID
      const inspectResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
            arguments: [tx.object(REGISTRY_ID), tx.pure.string(dropletId)],
          });
          return tx;
        })(),
        sender: currentAccount.address,
      });

      const returnValues = inspectResult.results?.[0]?.returnValues;
      
      if (!returnValues || returnValues.length === 0) {
        throw new Error('Droplet not found');
      }

      const optionBytes = returnValues[0][0];
      
      if (!optionBytes || optionBytes.length === 0) {
        throw new Error('Droplet not found');
      }

      const isSome = optionBytes[0] === 1;
      
      if (!isSome) {
        throw new Error('Droplet not found with ID: ' + dropletId);
      }

      const addressBytes = optionBytes.slice(1);
      const dropletAddress = `0x${Buffer.from(addressBytes).toString('hex')}`;

      // Get the droplet object to determine its coin type
      const dropletObject = await suiClient.getObject({
        id: dropletAddress,
        options: { showType: true, showContent: true }
      });

      if (!dropletObject.data) {
        throw new Error('Droplet object not found');
      }

      const dropletType = dropletObject.data.type;
      if (!dropletType) {
        throw new Error('Unable to determine droplet type');
      }

      const coinTypeMatch = dropletType.match(/<(.+)>/);
      if (!coinTypeMatch || !coinTypeMatch[1]) {
        throw new Error('Unable to extract coin type from droplet');
      }

      const coinType = coinTypeMatch[1];
      console.log('Detected coin type for cleanup:', coinType);

      // Create transaction to cleanup expired droplet
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::cleanup_droplet`,
        typeArguments: [coinType],
        arguments: [
          tx.object(dropletAddress),
          tx.object(CLOCK_ID),
        ],
      });

      signAndExecuteTransaction({ 
        transaction: tx,
      }, {
        onSuccess: (result: any) => {
          console.log('Cleanup transaction completed successfully:', result);
          
          let refundAmount = '';
          let reason = '';
          
          // Extract cleanup details from events
          if (result?.events && Array.isArray(result.events)) {
            for (const event of result.events) {
              if (event.type && event.type.includes('::DropletClosed')) {
                const parsedJson = event.parsedJson;
                if (parsedJson) {
                  refundAmount = parsedJson.refund_amount || '';
                  reason = parsedJson.reason || '';
                  break;
                }
              }
            }
          }
          
          // Also check effects.events
          if (!refundAmount && result?.effects?.events && Array.isArray(result.effects.events)) {
            for (const event of result.effects.events) {
              if (event.type && event.type.includes('::DropletClosed')) {
                const parsedJson = event.parsedJson;
                if (parsedJson) {
                  refundAmount = parsedJson.refund_amount || '';
                  reason = parsedJson.reason || '';
                  break;
                }
              }
            }
          }
          
          toast({
            title: "🔄 Droplet Cleaned Up Successfully!",
            description: refundAmount 
              ? `Refunded ${refundAmount} tokens. Reason: ${reason}` 
              : "Expired droplet has been processed and any remaining funds refunded.",
          });

          // Reset form
          setDropletId('');
          setError('');
        },
        onError: (error) => {
          console.error('Cleanup transaction failed:', error);
          let errorMessage = handleTransactionError(error);
          
          if (error?.message || error?.toString?.()) {
            const errorStr = (error.message || error.toString()).toLowerCase();
            if (errorStr.includes('droplet_expired') || errorStr.includes('not.*expired')) {
              errorMessage = 'This droplet is not yet expired and cannot be cleaned up';
            } else if (errorStr.includes('droplet_closed')) {
              errorMessage = 'This droplet has already been cleaned up';
            } else if (errorStr.includes('droplet_not_found')) {
              errorMessage = 'Droplet not found. Please check the droplet ID';
            }
          }
          
          toast({
            title: "Cleanup Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      });

    } catch (error: any) {
      console.error('Cleanup failed:', error);
      const errorMessage = handleTransactionError(error);
      toast({
        title: "Cleanup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientCard className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl sm:text-2xl flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Cleanup Expired Droplet
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Clean up expired droplets and refund remaining tokens
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cleanup-droplet-id" className="text-sm font-medium">
              Droplet ID <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="cleanup-droplet-id"
                placeholder="Enter 6-character droplet ID"
                value={dropletId}
                onChange={(e) => {
                  setDropletId(e.target.value.toUpperCase());
                  setError('');
                }}
                className={`pl-10 text-center font-mono text-lg ${error ? 'border-destructive' : ''}`}
                maxLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          <Button
            onClick={handleCleanup}
            disabled={loading || !dropletId}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Cleanup...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                <span>Cleanup Droplet</span>
              </div>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Only expired droplets can be cleaned up</li>
            <li>Any remaining tokens are refunded to the droplet creator</li>
            <li>Anyone can trigger cleanup for expired droplets</li>
          </ul>
        </div>
      </CardContent>
    </GradientCard>
  );
};