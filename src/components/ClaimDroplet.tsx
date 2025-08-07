import { useState } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, COIN_TYPE, CLOCK_ID } from '@/lib/suiClient';
import { Gift, User, Hash } from 'lucide-react';

export function ClaimDroplet() {
  const { signAndExecuteTransactionBlock, currentAccount } = useWalletKit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dropletId: '',
    claimerName: ''
  });

  const handleClaim = async () => {
    if (!currentAccount) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to claim from a droplet",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      if (!formData.dropletId || !formData.claimerName) {
        throw new Error('Please fill in all required fields');
      }

      // First, get the droplet address by ID
      const inspectResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
            arguments: [tx.object(REGISTRY_ID), tx.pure(formData.dropletId)],
          });
          return tx;
        })(),
        sender: currentAccount.address,
      });

      // Check if the function returned Some(address) or None
      const returnValues = inspectResult.results?.[0]?.returnValues;
      if (!returnValues || returnValues.length === 0) {
        throw new Error('Droplet not found');
      }

      // Parse the Option<address> return value
      const optionBytes = returnValues[0][0];
      if (!optionBytes || optionBytes.length === 0) {
        throw new Error('Droplet not found');
      }

      // The first byte indicates if it's Some(1) or None(0)
      const isSome = optionBytes[0] === 1;
      if (!isSome) {
        throw new Error('Droplet not found');
      }

      // Extract the address bytes (skip the first byte which is the option indicator)
      const addressBytes = optionBytes.slice(1);
      const dropletAddress = `0x${Buffer.from(addressBytes).toString('hex')}`;

      // Create transaction to claim
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::claim_internal`,
        typeArguments: [COIN_TYPE],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.object(dropletAddress),
          tx.pure(formData.dropletId),
          tx.pure(formData.claimerName),
          tx.object(CLOCK_ID),
        ],
      });

      const transactionResult = await signAndExecuteTransactionBlock({ 
        transactionBlock: tx as any,
        options: {
          showEffects: true,
        }
      });
      
      toast({
        title: "Successfully claimed!",
        description: `Transaction: ${transactionResult.digest.slice(0, 10)}...`,
      });

      // Reset form
      setFormData({
        dropletId: '',
        claimerName: ''
      });

    } catch (error: any) {
      let errorMessage = error.message || 'An unknown error occurred';
      
      // Parse common error codes
      if (errorMessage.includes('E_ALREADY_CLAIMED')) {
        errorMessage = 'You have already claimed from this droplet';
      } else if (errorMessage.includes('E_DROPLET_EXPIRED')) {
        errorMessage = 'This droplet has expired';
      } else if (errorMessage.includes('E_DROPLET_CLOSED')) {
        errorMessage = 'This droplet is closed';
      } else if (errorMessage.includes('E_RECEIVER_LIMIT_REACHED')) {
        errorMessage = 'Droplet has reached its recipient limit';
      } else if (errorMessage.includes('E_DROPLET_NOT_FOUND')) {
        errorMessage = 'Droplet not found. Please check the ID';
      }

      toast({
        title: "Failed to claim",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientCard variant="glow" className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Gift className="h-4 w-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Claim Airdrop</CardTitle>
        </div>
        <CardDescription>
          Enter your droplet ID and name to claim your airdrop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dropletId" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Droplet ID
            </Label>
            <Input
              id="dropletId"
              placeholder="A1B2C3"
              value={formData.dropletId}
              onChange={(e) => setFormData({ ...formData, dropletId: e.target.value.toUpperCase() })}
              className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimerName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Your Name
            </Label>
            <Input
              id="claimerName"
              placeholder="Enter your name"
              value={formData.claimerName}
              onChange={(e) => setFormData({ ...formData, claimerName: e.target.value })}
              className="bg-secondary/50 border-border/50 focus:border-primary/50"
            />
          </div>
        </div>

        <Button
          onClick={handleClaim}
          disabled={loading || !formData.dropletId || !formData.claimerName || !currentAccount}
          className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow transition-all duration-300"
        >
          {loading ? 'Claiming...' : 'Claim Airdrop'}
        </Button>
      </CardContent>
    </GradientCard>
  );
}