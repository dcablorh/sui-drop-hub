import { useState } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { suiClient, REGISTRY_ID, PACKAGE_ID, MODULE, COIN_TYPE, CLOCK_ID } from '@/lib/suiClient';
import { Send, Coins, Users, Clock, MessageSquare, Copy, QrCode, CheckCircle } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CreateDroplet() {
  const { signAndExecuteTransactionBlock, currentAccount } = useWalletKit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdDropletId, setCreatedDropletId] = useState('');
  const [formData, setFormData] = useState({
    amount: '',
    receiverLimit: '',
    expiryHours: '48',
    message: ''
  });
  const [formErrors, setFormErrors] = useState({
    amount: '',
    receiverLimit: '',
    expiryHours: '',
    message: ''
  });

  // Validation functions
  const validateForm = () => {
    const errors = {
      amount: '',
      receiverLimit: '',
      expiryHours: '',
      message: ''
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
      
      const amountValue = parseFloat(formData.amount);
      const receiverLimitValue = parseInt(formData.receiverLimit);
      const expiryHoursValue = parseInt(formData.expiryHours);

      const tx = new TransactionBlock();
      
      // Convert amount to mist (SUI smallest unit: 1 SUI = 1e9 mist)
      const amountInMist = Math.floor(amountValue * 1e9);

      // Create a coin object for the airdrop amount (not the gas coin)
      const [coin] = tx.splitCoins(tx.gas, [amountInMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_droplet`,
        typeArguments: [COIN_TYPE],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure(amountInMist),
          tx.pure(receiverLimitValue),
          tx.pure([expiryHoursValue]),
          tx.pure(formData.message || 'Airdrop from Sui Drop Hub'),
          coin, // Use the split coin, not tx.gas
          tx.object(CLOCK_ID),
        ],
      });

      const result = await signAndExecuteTransactionBlock({ 
        transactionBlock: tx as any,
        options: {
          showEffects: true,
          showEvents: true,
        }
      });

      // Extract droplet ID from events
      let dropletId = '';
      if (result.events) {
        console.log('Events:', result.events); // Debug logging
        const createEvent = result.events.find(event => 
          event.type.includes('DropletCreated') || event.type.includes('dropnew::DropletCreated')
        );
        console.log('Create event found:', createEvent); // Debug logging
        if (createEvent && createEvent.parsedJson) {
          dropletId = (createEvent.parsedJson as any).droplet_id;
          console.log('Extracted droplet ID:', dropletId); // Debug logging
        }
      }
      
      if (dropletId) {
        setCreatedDropletId(dropletId);
        setShowSuccess(true);
      } else {
        toast({
          title: "Droplet created successfully!",
          description: `Transaction: ${result.digest.slice(0, 10)}...`,
        });
      }

      // Reset form
      setFormData({
        amount: '',
        receiverLimit: '',
        expiryHours: '48',
        message: ''
      });
      setFormErrors({
        amount: '',
        receiverLimit: '',
        expiryHours: '',
        message: ''
      });

    } catch (error: any) {
      toast({
        title: "Failed to create droplet",
        description: error.message || 'An unknown error occurred',
        variant: "destructive"
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
        description: "Droplet ID copied to clipboard",
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
              Total Amount (SUI)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.1"
              placeholder="10.0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className={`bg-secondary/50 border-border/50 focus:border-primary/50 ${formErrors.amount ? 'border-destructive' : ''}`}
            />
            {formErrors.amount && (
              <p className="text-sm text-destructive mt-1">{formErrors.amount}</p>
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
              Your airdrop droplet has been created. Share the ID below with your community.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Droplet ID Display */}
            <div className="flex items-center justify-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Droplet ID</p>
                <p className="text-2xl font-mono font-bold tracking-wider text-primary">
                  {createdDropletId}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(createdDropletId)}
                variant="outline"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy ID
              </Button>
              <Button
                onClick={() => copyToClipboard(`${window.location.origin}/claim?id=${createdDropletId}`)}
                variant="outline"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCode
                value={`${window.location.origin}/claim?id=${createdDropletId}`}
                size={128}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Scan this QR code to share the claim link
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </GradientCard>
  );
}