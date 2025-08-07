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
import { Send, Coins, Users, Clock, MessageSquare } from 'lucide-react';

export function CreateDroplet() {
  const { signAndExecuteTransactionBlock, currentAccount } = useWalletKit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    receiverLimit: '',
    expiryHours: '48',
    message: ''
  });

  const handleCreate = async () => {
    if (!currentAccount) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a droplet",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const amountValue = parseFloat(formData.amount);
      const receiverLimitValue = parseInt(formData.receiverLimit);
      const expiryHoursValue = parseInt(formData.expiryHours);

      if (!amountValue || !receiverLimitValue) {
        throw new Error('Please fill in all required fields');
      }

      const tx = new TransactionBlock();
      
      // Convert amount to mist (SUI smallest unit: 1 SUI = 1e9 mist)
      const amountInMist = Math.floor(amountValue * 1e9);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_droplet`,
        typeArguments: [COIN_TYPE],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure(amountInMist),
          tx.pure(receiverLimitValue),
          tx.pure({ Some: expiryHoursValue }),
          tx.pure(formData.message || 'Airdrop from Sui Drop Hub'),
          tx.gas,
          tx.object(CLOCK_ID),
        ],
      });

      const result = await signAndExecuteTransactionBlock({ 
        transactionBlock: tx as any,
        options: {
          showEffects: true,
        }
      });
      
      toast({
        title: "Droplet created successfully!",
        description: `Transaction: ${result.digest.slice(0, 10)}...`,
      });

      // Reset form
      setFormData({
        amount: '',
        receiverLimit: '',
        expiryHours: '48',
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
              className="bg-secondary/50 border-border/50 focus:border-primary/50"
            />
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
              value={formData.receiverLimit}
              onChange={(e) => setFormData({ ...formData, receiverLimit: e.target.value })}
              className="bg-secondary/50 border-border/50 focus:border-primary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryHours" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiry (Hours)
            </Label>
            <Input
              id="expiryHours"
              type="number"
              value={formData.expiryHours}
              onChange={(e) => setFormData({ ...formData, expiryHours: e.target.value })}
              className="bg-secondary/50 border-border/50 focus:border-primary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message (Optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Welcome to our community airdrop!"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="bg-secondary/50 border-border/50 focus:border-primary/50 min-h-20"
            />
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
    </GradientCard>
  );
}