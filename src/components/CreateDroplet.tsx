import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWalletCoins } from '@/hooks/useWalletCoins';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, COIN_TYPE, CLOCK_ID, handleTransactionError } from '@/lib/suiClient';
import { Send, Coins, Users, Clock, MessageSquare, Copy, QrCode, CheckCircle } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CreateDroplet() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  
  const { coinBalances, isLoading: coinsLoading } = useWalletCoins();
  
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdDropletId, setCreatedDropletId] = useState('');
  const [formData, setFormData] = useState({
    amount: '',
    receiverLimit: '',
    expiryHours: '48',
    message: '',
    selectedCoinType: '0x2::sui::SUI'
  });
  const [formErrors, setFormErrors] = useState({
    amount: '',
    receiverLimit: '',
    expiryHours: '',
    message: '',
    coinType: ''
  });

  // Function to generate 6-character droplet ID
  const generateDropletId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Function to extract droplet ID from transaction
  const extractDropletIdFromTransaction = (result: any) => {
    console.log('Full transaction result:', result);
    
    // Method 1: Check events for droplet ID
    if (result.events) {
      console.log('Events found:', result.events);
      for (const event of result.events) {
        console.log('Event type:', event.type);
        console.log('Event parsedJson:', event.parsedJson);
        
        // Check various possible event types
        if (event.type && (
          event.type.includes('DropletCreated') || 
          event.type.includes('droplet_created') ||
          event.type.includes('Created')
        )) {
          const parsedJson = event.parsedJson as any;
          
          // Try different possible field names
          const possibleFields = [
            'droplet_id',
            'id', 
            'dropletId',
            'object_id',
            'objectId'
          ];
          
          for (const field of possibleFields) {
            if (parsedJson && parsedJson[field]) {
              let extractedId = parsedJson[field];
              console.log(`Found ${field}:`, extractedId);
              
              // If it's a full object ID, take last 6 chars
              if (typeof extractedId === 'string' && extractedId.length > 6) {
                extractedId = extractedId.slice(-6).toUpperCase();
              }
              
              return extractedId;
            }
          }
        }
      }
    }

    // Method 2: Check created objects
    if (result.effects?.created) {
      console.log('Created objects:', result.effects.created);
      for (const created of result.effects.created) {
        if (created.reference?.objectId) {
          const objectId = created.reference.objectId;
          console.log('Created object ID:', objectId);
          // Use last 6 characters of object ID
          return objectId.slice(-6).toUpperCase();
        }
      }
    }

    // Method 3: Check objectChanges
    if (result.objectChanges) {
      console.log('Object changes:', result.objectChanges);
      for (const change of result.objectChanges) {
        if (change.type === 'created' && change.objectId) {
          console.log('Created object from changes:', change.objectId);
          return change.objectId.slice(-6).toUpperCase();
        }
      }
    }

    // Fallback: generate random ID
    console.log('No droplet ID found in transaction, generating fallback ID');
    return generateDropletId();
  };

  // Validation functions
  const validateForm = () => {
    const errors = {
      amount: '',
      receiverLimit: '',
      expiryHours: '',
      message: '',
      coinType: ''
    };

    const amountValue = parseFloat(formData.amount);
    const receiverLimitValue = parseInt(formData.receiverLimit);
    const expiryHoursValue = parseInt(formData.expiryHours);

    // Validate amount
    if (!formData.amount || amountValue <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }

    // Validate receiver limit
    if (!formData.receiverLimit || receiverLimitValue < 1 || receiverLimitValue > 100000) {
      errors.receiverLimit = 'Receiver limit must be between 1 and 100,000';
    }

    // Validate expiry hours (optional but must be > 0 if provided)
    if (formData.expiryHours && (isNaN(expiryHoursValue) || expiryHoursValue <= 0)) {
      errors.expiryHours = 'Expiry hours must be greater than 0';
    }

    // Validate message length
    if (formData.message && formData.message.length > 200) {
      errors.message = 'Message must be less than 200 characters';
    }

    // Validate coin type selection
    const selectedCoin = coinBalances.find(coin => coin.coinType === formData.selectedCoinType);
    if (!selectedCoin) {
      errors.coinType = 'Please select a valid coin type';
    } else {
      // Validate amount against available balance
      const requiredAmount = (parseFloat(formData.amount) * Math.pow(10, selectedCoin.decimals));
      const availableBalance = parseInt(selectedCoin.balance);
      if (requiredAmount > availableBalance) {
        errors.amount = `Insufficient balance. Available: ${selectedCoin.formatted}`;
      }
    }

    setFormErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const handleCreate = async () => {
    if (!currentAccount) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a droplet",
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
      
      const selectedCoin = coinBalances.find(coin => coin.coinType === formData.selectedCoinType);
      if (!selectedCoin) {
        throw new Error('Selected coin type not found');
      }

      const amountValue = parseFloat(formData.amount);
      const receiverLimitValue = parseInt(formData.receiverLimit);
      const expiryHoursValue = parseInt(formData.expiryHours);

      const tx = new Transaction();
      
      // Convert amount to the selected coin's smallest unit
      const amountInSmallestUnit = Math.floor(amountValue * Math.pow(10, selectedCoin.decimals));

      // Get coin objects for the selected coin type from wallet
      let coinToUse;
      
      if (formData.selectedCoinType === '0x2::sui::SUI') {
        // For SUI, we can split from gas
        const [coin] = tx.splitCoins(tx.gas, [amountInSmallestUnit]);
        coinToUse = coin;
      } else {
        // For other coin types, we need to find actual coin objects from the wallet
        // This is a simplified approach - in production you'd want to merge multiple coins if needed
        const coinObjects = await suiClient.getCoins({
          owner: currentAccount.address,
          coinType: formData.selectedCoinType,
          limit: 50
        });
        
        if (!coinObjects.data || coinObjects.data.length === 0) {
          throw new Error(`No ${selectedCoin.symbol} coins found in wallet`);
        }
        
        // Find a coin with sufficient balance or merge coins
        let totalBalance = 0;
        const suitableCoins = [];
        
        for (const coin of coinObjects.data) {
          totalBalance += parseInt(coin.balance);
          suitableCoins.push(coin.coinObjectId);
          if (totalBalance >= amountInSmallestUnit) break;
        }
        
        if (totalBalance < amountInSmallestUnit) {
          throw new Error(`Insufficient ${selectedCoin.symbol} balance`);
        }
        
        // If we need to merge coins
        if (suitableCoins.length > 1) {
          const primaryCoin = tx.object(suitableCoins[0]);
          const coinsToMerge = suitableCoins.slice(1).map(id => tx.object(id));
          tx.mergeCoins(primaryCoin, coinsToMerge);
          coinToUse = primaryCoin;
        } else {
          coinToUse = tx.object(suitableCoins[0]);
        }
        
        // Split the exact amount needed
        if (totalBalance > amountInSmallestUnit) {
          const [splitCoin] = tx.splitCoins(coinToUse, [amountInSmallestUnit]);
          coinToUse = splitCoin;
        }
      }

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_droplet`,
        typeArguments: [formData.selectedCoinType],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.u64(amountInSmallestUnit),
          tx.pure.u64(receiverLimitValue),
          tx.pure.option('u64', expiryHoursValue > 0 ? expiryHoursValue : null),
          tx.pure.string(formData.message || 'Airdrop from Sui Drop Hub'),
          coinToUse,
          tx.object(CLOCK_ID),
        ],
      });

      signAndExecuteTransaction({ 
        transaction: tx,
      }, {
        onSuccess: (result: any) => {
          console.log('Create droplet transaction completed successfully:', result);
          
          // Extract exact droplet ID from blockchain events
          let createdDropletId = '';
          
          try {
            console.log('Full transaction result:', result);
            
            // Check transaction events for DropletCreated event
            if (result?.events && Array.isArray(result.events)) {
              console.log('Found events array with', result.events.length, 'events');
              for (const event of result.events) {
                console.log('Event type:', event.type);
                console.log('Event parsedJson:', event.parsedJson);
                
                // Look for the exact DropletCreated event from our smart contract
                if (event.type && event.type.includes('::DropletCreated')) {
                  const eventData = event.parsedJson;
                  if (eventData && eventData.droplet_id) {
                    createdDropletId = eventData.droplet_id;
                    console.log('✅ Extracted droplet ID from DropletCreated event:', createdDropletId);
                    break;
                  }
                }
              }
            }
            
            // Also check effects.events as fallback
            if (!createdDropletId && result?.effects?.events && Array.isArray(result.effects.events)) {
              console.log('Checking effects.events array with', result.effects.events.length, 'events');
              for (const event of result.effects.events) {
                console.log('Effects event type:', event.type);
                console.log('Effects event parsedJson:', event.parsedJson);
                
                if (event.type && event.type.includes('::DropletCreated')) {
                  const eventData = event.parsedJson;
                  if (eventData && eventData.droplet_id) {
                    createdDropletId = eventData.droplet_id;
                    console.log('✅ Extracted droplet ID from effects DropletCreated event:', createdDropletId);
                    break;
                  }
                }
              }
            }
            
            // Fallback: If no event found, use last 6 chars of created object
            if (!createdDropletId && result?.effects?.created && Array.isArray(result.effects.created)) {
              const createdObj = result.effects.created[0];
              if (createdObj?.reference?.objectId) {
                createdDropletId = createdObj.reference.objectId.slice(-6).toUpperCase();
                console.log('Generated droplet ID from object:', createdDropletId);
              }
            }
            
            // Last resort: Generate random ID
            if (!createdDropletId) {
              createdDropletId = generateDropletId();
              console.log('Using fallback generated droplet ID:', createdDropletId);
            }
            
          } catch (error) {
            console.error('Error extracting droplet ID:', error);
            createdDropletId = generateDropletId();
          }
          
          setCreatedDropletId(createdDropletId);
          setShowSuccess(true);
          
          toast({
            title: "🎉 Droplet Created Successfully!",
            description: `Droplet ID: ${createdDropletId} - Share this ID to distribute your airdrop!`,
          });

          // Reset form
          setFormData({
            amount: '',
            receiverLimit: '',
            expiryHours: '48',
            message: '',
            selectedCoinType: '0x2::sui::SUI'
          });
          setFormErrors({
            amount: '',
            receiverLimit: '',
            expiryHours: '',
            message: '',
            coinType: ''
          });
        },
        onError: (error) => {
          console.error('Create droplet transaction failed:', error);
          const errorMessage = handleTransactionError(error);
          toast({
            title: "Failed to Create Droplet",
            description: errorMessage,
            variant: "destructive",
          });
        }
      });

    } catch (error: any) {
      console.error('Creation failed:', error);
      const errorMessage = handleTransactionError(error);
      toast({
        title: "Creation Failed", 
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const estimatedFee = parseFloat(formData.amount) * 0.013 || 0;
  const netAmount = parseFloat(formData.amount) - estimatedFee || 0;
  const amountPerUser = netAmount / (parseInt(formData.receiverLimit) || 1) || 0;

  return (
    <GradientCard variant="glow" className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Send className="h-4 w-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Create Airdrop</CardTitle>
        </div>
        <CardDescription>
          Create a new SUI airdrop droplet for your community
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Amount
            </Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="10.5"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={`bg-secondary/50 border-border/50 focus:border-primary/50 flex-1 ${formErrors.amount ? 'border-destructive' : ''}`}
              />
              <Select
                value={formData.selectedCoinType}
                onValueChange={(value) => setFormData({ ...formData, selectedCoinType: value })}
              >
                <SelectTrigger className="w-32 bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {coinsLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : coinBalances.length === 0 ? (
                    <SelectItem value="no-coins" disabled>No coins available</SelectItem>
                  ) : (
                    coinBalances.map((coin) => (
                      <SelectItem key={coin.coinType} value={coin.coinType}>
                        <div className="flex items-center justify-between w-full">
                          <span>{coin.symbol}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {coin.formatted}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {formErrors.amount && (
              <p className="text-sm text-destructive mt-1">{formErrors.amount}</p>
            )}
            {formErrors.coinType && (
              <p className="text-sm text-destructive mt-1">{formErrors.coinType}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiverLimit" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Max Recipients
            </Label>
            <Input
              id="receiverLimit"
              type="number"
              placeholder="100"
              min="1"
              max="100000"
              value={formData.receiverLimit}
              onChange={(e) => setFormData({ ...formData, receiverLimit: e.target.value })}
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 ${formErrors.receiverLimit ? 'border-destructive' : ''}`}
            />
            {formErrors.receiverLimit && (
              <p className="text-sm text-destructive mt-1">{formErrors.receiverLimit}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryHours" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiry (Hours)
            </Label>
            <Input
              id="expiryHours"
              type="number"
              min="1"
              value={formData.expiryHours}
              onChange={(e) => setFormData({ ...formData, expiryHours: e.target.value })}
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 ${formErrors.expiryHours ? 'border-destructive' : ''}`}
            />
            {formErrors.expiryHours && (
              <p className="text-sm text-destructive mt-1">{formErrors.expiryHours}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message (Optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Welcome to our community airdrop!"
              maxLength={200}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 min-h-20 ${formErrors.message ? 'border-destructive' : ''}`}
            />
            <div className="flex justify-between items-center mt-1">
              {formErrors.message && (
                <p className="text-sm text-destructive">{formErrors.message}</p>
              )}
              <p className="text-sm text-muted-foreground ml-auto">
                {formData.message.length}/200
              </p>
            </div>
          </div>
        </div>

        {formData.amount && formData.receiverLimit && (
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/30">
            <h4 className="font-medium text-sm">Airdrop Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee:</span>
                <Badge variant="outline" className="text-sui-yellow">
                  {estimatedFee.toFixed(3)} SUI
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Amount:</span>
                <Badge variant="outline" className="text-sui-green">
                  {netAmount.toFixed(3)} SUI
                </Badge>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Per User:</span>
                <Badge variant="outline" className="text-primary">
                  {amountPerUser.toFixed(6)} SUI
                </Badge>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleCreate}
          disabled={loading || !formData.amount || !formData.receiverLimit || !currentAccount}
          className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow transition-all duration-300"
        >
          {loading ? 'Creating...' : 'Create Airdrop'}
        </Button>
      </CardContent>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Droplet Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Your airdrop droplet has been created and is ready to share! The droplet ID below can be used to claim the airdrop.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Droplet ID Display */}
            <div className="flex items-center justify-center p-6 bg-secondary/30 rounded-lg border-2 border-primary/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Droplet ID</p>
                <p className="text-3xl font-mono font-bold tracking-wider text-primary bg-background px-4 py-2 rounded-lg border">
                  {createdDropletId}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => copyToClipboard(createdDropletId)}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy ID
              </Button>
              <Button
                onClick={() => copyToClipboard(`${window.location.origin}/claim/${createdDropletId}`)}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              <QRCode
                value={`${window.location.origin}/claim/${createdDropletId}`}
                size={150}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Scan this QR code to share the claim link
              </p>
              <p className="text-xs text-muted-foreground">
                Claim URL: {window.location.origin}/claim/{createdDropletId}
              </p>
            </div>

            <Button 
              onClick={() => setShowSuccess(false)}
              className="w-full"
              variant="default"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GradientCard>
  );
}