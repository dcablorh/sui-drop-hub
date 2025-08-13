import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, COIN_TYPE, CLOCK_ID, handleTransactionError } from '@/lib/suiClient';
import { Gift, User, Hash } from 'lucide-react';

interface ClaimDropletProps {
  prefilledDropletId?: string;
}

export function ClaimDroplet({ prefilledDropletId = '' }: ClaimDropletProps) {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
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

  useEffect(() => {
    if (prefilledDropletId) {
      setFormData(prev => ({ ...prev, dropletId: prefilledDropletId.toUpperCase() }));
    }
  }, [prefilledDropletId]);

  const validateForm = () => {
    const errors = { dropletId: '', claimerName: '' };
    const dropletIdRegex = /^[A-Z0-9]{6}$/;

    if (!formData.dropletId) {
      errors.dropletId = 'Droplet ID is required';
    } else if (!dropletIdRegex.test(formData.dropletId)) {
      errors.dropletId = 'Must be exactly 6 uppercase letters/numbers';
    }

    if (!formData.claimerName.trim()) {
      errors.claimerName = 'Name is required';
    } else if (formData.claimerName.length > 50) {
      errors.claimerName = 'Max 50 characters';
    }

    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleClaim = async () => {
    if (!account) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to claim",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Fix the errors before submitting",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Find droplet address by ID
      const inspectResult = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE}::find_droplet_by_id`,
            arguments: [tx.object(REGISTRY_ID), tx.pure.string(formData.dropletId)],
          });
          return tx;
        })(),
        sender: account.address,
      });

      const returnValues = inspectResult.results?.[0]?.returnValues;
      if (!returnValues?.length) throw new Error('Droplet not found');

      const optionBytes = returnValues[0][0];
      if (!optionBytes?.length || optionBytes[0] !== 1) throw new Error('Droplet not found');

      const dropletAddress = `0x${Buffer.from(optionBytes.slice(1)).toString('hex')}`;

      // Claim transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::claim_internal`,
        typeArguments: [COIN_TYPE],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.object(dropletAddress),
          tx.pure.string(formData.dropletId),
          tx.pure.string(formData.claimerName),
          tx.object(CLOCK_ID),
        ],
      });

      signAndExecuteTransaction({
        transaction: tx,
      }, {
        onSuccess: (transactionResult) => {
          toast({
            title: "Successfully claimed!",
            description: `Tx: ${transactionResult.digest.slice(0, 10)}...`,
          });

          setFormData({ dropletId: '', claimerName: '' });
          setFormErrors({ dropletId: '', claimerName: '' });
          setLoading(false);
        },
        onError: (error: any) => {
          console.error(error);
          toast({
            title: "Claim Failed",
            description: handleTransactionError(error),
            variant: "destructive",
          });
          setLoading(false);
        }
      });

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Claim Failed",
        description: handleTransactionError(error),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <GradientCard variant="glow" className="w-full max-w-lg">
      <CardHeader>
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
        {/* Wallet Connection */}
        {!account && (
          <div className="w-full flex justify-center">
            <ConnectButton />
          </div>
        )}

        {/* Droplet ID */}
        <div className="space-y-2">
          <Label htmlFor="dropletId" className="flex items-center gap-2">
            <Hash className="h-4 w-4" /> Droplet ID
          </Label>
          <Input
            id="dropletId"
            placeholder="A1B2C3"
            value={formData.dropletId}
            onChange={(e) => setFormData({ ...formData, dropletId: e.target.value.toUpperCase() })}
            maxLength={6}
            className={`font-mono ${formErrors.dropletId ? 'border-destructive' : ''}`}
          />
          {formErrors.dropletId && <p className="text-sm text-destructive">{formErrors.dropletId}</p>}
        </div>

        {/* Claimer Name */}
        <div className="space-y-2">
          <Label htmlFor="claimerName" className="flex items-center gap-2">
            <User className="h-4 w-4" /> Your Name
          </Label>
          <Input
            id="claimerName"
            placeholder="Enter your name"
            maxLength={50}
            value={formData.claimerName}
            onChange={(e) => setFormData({ ...formData, claimerName: e.target.value })}
            className={formErrors.claimerName ? 'border-destructive' : ''}
          />
          <div className="flex justify-between">
            {formErrors.claimerName && <p className="text-sm text-destructive">{formErrors.claimerName}</p>}
            <p className="text-sm text-muted-foreground">{formData.claimerName.length}/50</p>
          </div>
        </div>

        {/* Claim Button */}
        <Button
          onClick={handleClaim}
          disabled={loading || !formData.dropletId || !formData.claimerName || !account}
          className="w-full bg-gradient-primary text-primary-foreground"
        >
          {loading ? 'Claiming...' : 'Claim Airdrop'}
        </Button>
      </CardContent>
    </GradientCard>
  );
}
