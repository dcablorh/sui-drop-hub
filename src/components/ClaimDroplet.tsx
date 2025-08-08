import { useState, useEffect } from 'react';
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

interface ClaimDropletProps {
  prefilledDropletId?: string;
}

export function ClaimDroplet({ prefilledDropletId = '' }: ClaimDropletProps) {
  const { signAndExecuteTransactionBlock, currentAccount } = useWalletKit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dropletId: prefilledDropletId,
    claimerName: ''
  });
  const [formErrors, setFormErrors] = useState({
    dropletId: '',
    claimerName: ''
  });

  // Update form when prefilledDropletId changes
  useEffect(() => {
    if (prefilledDropletId) {
      setFormData(prev => ({ ...prev, dropletId: prefilledDropletId }));
    }
  }, [prefilledDropletId]);

  // Validation functions
  const validateForm = () => {
    const errors = {
      dropletId: '',
      claimerName: ''
    };

    // Validate droplet ID - exactly 6 uppercase alphanumeric characters
    const dropletIdRegex = /^[A-Z0-9]{6}$/;
    if (!formData.dropletId) {
      errors.dropletId = 'Droplet ID is required';
    } else if (!dropletIdRegex.test(formData.dropletId)) {
      errors.dropletId = 'Droplet ID must be exactly 6 uppercase alphanumeric characters';
    }

    // Validate claimer name - non-empty string with max 50 characters
    if (!formData.claimerName.trim()) {
      errors.claimerName = 'Name is required';
    } else if (formData.claimerName.length > 50) {
      errors.claimerName = 'Name must be less than 50 characters';
    }

    setFormErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const handleClaim = async () => {
    if (!currentAccount) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to claim from a droplet",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the form errors before submitting",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

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
      setFormErrors({
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
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 font-mono ${formErrors.dropletId ? 'border-destructive' : ''}`}
              maxLength={6}
            />
            {formErrors.dropletId && (
              <p className="text-sm text-destructive mt-1">{formErrors.dropletId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimerName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Your Name
            </Label>
            <Input
              id="claimerName"
              placeholder="Enter your name"
              maxLength={50}
              value={formData.claimerName}
              onChange={(e) => setFormData({ ...formData, claimerName: e.target.value })}
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 ${formErrors.claimerName ? 'border-destructive' : ''}`}
            />
            <div className="flex justify-between items-center mt-1">
              {formErrors.claimerName && (
                <p className="text-sm text-destructive">{formErrors.claimerName}</p>
              )}
              <p className="text-sm text-muted-foreground ml-auto">
                {formData.claimerName.length}/50
              </p>
            </div>
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