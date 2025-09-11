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

export function CleanupDroplet() {
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
    <GradientCard variant="glow" className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-white" />
          </div>
          <CardTitle className="text-xl">Cleanup Expired Droplet</CardTitle>
        </div>
        <CardDescription>
          Cleanup expired droplets to reclaim remaining funds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cleanupDropletId" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Droplet ID
          </Label>
          <Input
            id="cleanupDropletId"
            placeholder="A1B2C3"
            value={dropletId}
            onChange={(e) => {
              setDropletId(e.target.value.toUpperCase());
              if (error) setError('');
            }}
            className={`bg-secondary/50 border-border/50 focus:border-primary/50 font-mono ${error ? 'border-destructive' : ''}`}
            maxLength={6}
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>

        <Button
          onClick={handleCleanup}
          disabled={loading || !dropletId || !currentAccount}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white shadow-glow transition-all duration-300"
        >
          {loading ? 'Processing...' : 'Cleanup Expired Droplet'}
        </Button>
      </CardContent>
    </GradientCard>
  );
}