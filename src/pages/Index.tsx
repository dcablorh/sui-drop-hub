import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { CreateDroplet } from '@/components/CreateDroplet';
import { ClaimDroplet } from '@/components/ClaimDroplet';
import { QRScanner } from '@/components/QRScanner';
import { PlatformStats } from '@/components/PlatformStats';
import { UserDashboard } from '@/components/UserDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Send, Gift, TrendingUp, Star, Zap, Shield, Clock, QrCode, User, Settings } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [prefilledDropletId, setPrefilledDropletId] = useState('');

  // Check URL parameters for direct claiming
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dropletId = urlParams.get('id');
    if (dropletId && dropletId.length === 6 && /^[A-Z0-9]{6}$/.test(dropletId.toUpperCase())) {
      setPrefilledDropletId(dropletId.toUpperCase());
      setActiveTab('claim');
    }
  }, []);

  const handleDropletIdFound = (dropletId: string) => {
    setPrefilledDropletId(dropletId);
    setActiveTab('claim');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <div className="space-y-4">
            <Badge variant="outline" className="border-primary/30 text-primary animate-pulse-slow">
              <Zap className="h-3 w-3 mr-1" />
              Powered by Sui Network
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent leading-tight">
              Sui Drop Hub
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create and claim airdrops on the Sui blockchain. Fast, secure, and efficient token distribution platform.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-gradient-hero border border-primary/20">
              <Shield className="h-8 w-8 text-sui-blue" />
              <h3 className="font-semibold">Secure</h3>
              <p className="text-sm text-muted-foreground text-center">
                Built on Sui's secure smart contract platform
              </p>
            </div>
            <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-gradient-hero border border-primary/20">
              <Zap className="h-8 w-8 text-sui-yellow" />
              <h3 className="font-semibold">Fast</h3>
              <p className="text-sm text-muted-foreground text-center">
                Lightning-fast transactions with low fees
              </p>
            </div>
            <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-gradient-hero border border-primary/20">
              <Star className="h-8 w-8 text-sui-purple" />
              <h3 className="font-semibold">Simple</h3>
              <p className="text-sm text-muted-foreground text-center">
                Easy-to-use interface for creating and claiming airdrops
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-6 bg-secondary/50 border border-border/50">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="claim" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Claim
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Admin
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-0">
              <div className="flex justify-center">
                <CreateDroplet />
              </div>
            </TabsContent>
            
            <TabsContent value="search" className="space-y-0">
              <div className="flex justify-center">
                <QRScanner onDropletIdFound={handleDropletIdFound} />
              </div>
            </TabsContent>
            
            <TabsContent value="claim" className="space-y-0">
              <div className="flex justify-center">
                <ClaimDroplet prefilledDropletId={prefilledDropletId} />
              </div>
            </TabsContent>
            
            <TabsContent value="dashboard" className="space-y-0">
              <div className="flex justify-center">
                <UserDashboard />
              </div>
            </TabsContent>
            
            <TabsContent value="stats" className="space-y-0">
              <div className="max-w-2xl mx-auto">
                <PlatformStats />
              </div>
            </TabsContent>
            
            <TabsContent value="admin" className="space-y-0">
              <div className="flex justify-center">
                <AdminDashboard />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GradientCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Creating Airdrops
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">1</Badge>
                  <p className="text-sm">Connect your Sui wallet to the platform</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">2</Badge>
                  <p className="text-sm">Set amount, recipients limit, and expiry time</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">3</Badge>
                  <p className="text-sm">Add an optional message for recipients</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">4</Badge>
                  <p className="text-sm">Share the generated 6-character droplet ID</p>
                </div>
              </CardContent>
            </GradientCard>

            <GradientCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Claiming Airdrops
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">1</Badge>
                  <p className="text-sm">Get the droplet ID from the airdrop creator</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">2</Badge>
                  <p className="text-sm">Connect your Sui wallet to the platform</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">3</Badge>
                  <p className="text-sm">Enter the droplet ID and your name</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">4</Badge>
                  <p className="text-sm">Claim your tokens instantly</p>
                </div>
              </CardContent>
            </GradientCard>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border/30">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Sui Drop Hub</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built on Sui Network • Decentralized Airdrop Platform
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>Network: Testnet</span>
            <span>•</span>
            <span>Platform Fee: 1.3%</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
