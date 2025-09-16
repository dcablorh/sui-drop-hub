import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { GlassButton } from '@/components/ui/glass-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/glass-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, COIN_TYPE, CLOCK_ID, handleTransactionError } from '@/lib/suiClient';
import { Gift, User, Hash } from 'lucide-react';

interface ClaimDropletProps {
  prefilledDropletId?: string;
}

export function ClaimDroplet({ prefilledDropletId = '' }: ClaimDropletProps) {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
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
            arguments: [tx.object(REGISTRY_ID), tx.pure.string(formData.dropletId)],
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
        throw new Error('Droplet not found with ID: ' + formData.dropletId);
      }

      // Extract the address bytes (skip the first byte which is the option indicator)
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

      // Extract coin type from the droplet object type
      // Type format: "0xpackage::module::Droplet<0x2::sui::SUI>"
      const dropletType = dropletObject.data.type;
      if (!dropletType) {
        throw new Error('Unable to determine droplet type');
      }

      // Extract the CoinType from the generic type parameter
      const coinTypeMatch = dropletType.match(/<(.+)>/);
      if (!coinTypeMatch || !coinTypeMatch[1]) {
        throw new Error('Unable to extract coin type from droplet');
      }

      const coinType = coinTypeMatch[1];
      console.log('Detected coin type:', coinType);

      // Create transaction to claim with the correct coin type
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::claim_internal`,
        typeArguments: [coinType],
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
        onSuccess: (result: any) => {
          console.log('Claim transaction completed successfully:', result);
          
          // Extract claim details from events with proper type checking
          let claimMessage = '';
          let claimAmount = '';
          
          if (result && typeof result === 'object' && result.effects && typeof result.effects === 'object') {
            const effects = result.effects;
            if (effects.events && Array.isArray(effects.events)) {
              for (const event of effects.events) {
                if (event.type && event.type.includes('DropletClaimed') && event.parsedJson) {
                  claimMessage = event.parsedJson.message || '';
                  claimAmount = event.parsedJson.claim_amount || '';
                  break;
                }
              }
            }
          }
          
          toast({
            title: "🎉 Successfully claimed!",
            description: claimMessage 
              ? `Message: "${claimMessage}" • Amount claimed successfully!` 
              : "Your airdrop claim was successful!",
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
        },
        onError: (error) => {
          console.error('Claim transaction failed:', error);
          let errorMessage = handleTransactionError(error);
          
          // Provide specific messages for common claim errors
          if (error?.message || error?.toString?.()) {
            const errorStr = (error.message || error.toString()).toLowerCase();
            if (errorStr.includes('already_claimed')) {
              errorMessage = 'You have already claimed from this droplet';
            } else if (errorStr.includes('droplet_expired')) {
              errorMessage = 'This droplet has expired and is no longer available';
            } else if (errorStr.includes('droplet_closed')) {
              errorMessage = 'This droplet has been closed';
            } else if (errorStr.includes('receiver_limit_reached')) {
              errorMessage = 'All available claims for this droplet have been taken';
            } else if (errorStr.includes('insufficient_balance')) {
              errorMessage = 'This droplet has no remaining balance to claim';
            } else if (errorStr.includes('droplet_not_found')) {
              errorMessage = 'Droplet not found. Please check the droplet ID';
            }
          }
          
          toast({
            title: "Claim Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      });

    } catch (error: any) {
      console.error('Claim failed:', error);
      const errorMessage = handleTransactionError(error);
      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard variant="glow" className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
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
              className={`bg-white/10 backdrop-blur-[10px] border-white/30 focus:border-cyan-400/50 text-white placeholder:text-white/60 font-mono ${formErrors.dropletId ? 'border-red-400/50' : ''}`}
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
              className={`bg-white/10 backdrop-blur-[10px] border-white/30 focus:border-cyan-400/50 text-white placeholder:text-white/60 ${formErrors.claimerName ? 'border-red-400/50' : ''}`}
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

        <GlassButton
          onClick={handleClaim}
          disabled={loading || !formData.dropletId || !formData.claimerName || !currentAccount}
          variant="neon"
          className="w-full"
        >
          {loading ? 'Claiming...' : 'Claim Airdrop'}
        </GlassButton>
      </CardContent>
    </GlassCard>
  );
}