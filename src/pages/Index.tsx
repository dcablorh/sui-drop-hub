import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { CreateDroplet } from '@/components/CreateDroplet';
import { ClaimDroplet } from '@/components/ClaimDroplet';
import { CleanupDroplet } from '@/components/CleanupDroplet';

import { QRScanner } from '@/components/QRScanner';

import { UserDashboard } from '@/components/UserDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Send, Gift, Star, Zap, Shield, Clock, QrCode, User, Settings, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

const ADMIN_ADDRESS = '0xe2bf986ccb385f8e5d9500ce8332b69a5cee19579152c240c09213e80e9355b8';

const Index = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [prefilledDropletId, setPrefilledDropletId] = useState('');
  const currentAccount = useCurrentAccount();
  const { dropletId: routeDropletId } = useParams();
  
  const isAdmin = currentAccount?.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  // Check URL parameters and route params for direct claiming
  useEffect(() => {
    // First check route params
    if (routeDropletId && routeDropletId.length === 6 && /^[A-Z0-9]{6}$/.test(routeDropletId.toUpperCase())) {
      setPrefilledDropletId(routeDropletId.toUpperCase());
      setActiveTab('claim');
      return;
    }
    
    // Then check URL search params for backward compatibility
    const urlParams = new URLSearchParams(window.location.search);
    const searchDropletId = urlParams.get('id');
    if (searchDropletId && searchDropletId.length === 6 && /^[A-Z0-9]{6}$/.test(searchDropletId.toUpperCase())) {
      setPrefilledDropletId(searchDropletId.toUpperCase());
      setActiveTab('claim');
    }
  }, [routeDropletId]);

  const handleDropletIdFound = (dropletId: string) => {
    setPrefilledDropletId(dropletId);
    setActiveTab('claim');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} bg-secondary/50 border border-border/50 max-w-2xl mx-auto`}>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="claim" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Search & Claim
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Admin
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="create" className="space-y-0">
              <div className="flex justify-center px-2">
                <div className="w-full max-w-2xl">
                  <CreateDroplet />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="claim" className="space-y-6">
              <div className="flex flex-col items-center space-y-6 px-2">
                <div className="w-full max-w-2xl">
                  <ClaimDroplet prefilledDropletId={prefilledDropletId} />
                </div>
                <div className="w-full max-w-2xl">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    
                  </div>
                  
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="dashboard" className="space-y-0">
              <div className="flex justify-center px-2">
                <div className="w-full">
                  <UserDashboard />
                </div>
              </div>
            </TabsContent>
            
            {isAdmin && (
               <TabsContent value="admin" className="space-y-0">
                 <div className="flex justify-center">
                   <AdminDashboard />
                 </div>
               </TabsContent>
             )}
          </Tabs>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-4 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-4 text-lg font-semibold hover:bg-secondary/50">
                <span>How It Works</span>
                <ChevronDown className="h-5 w-5 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4 pb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GradientCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Send className="h-5 w-5 text-primary" />
                      Creating Airdrops
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">1</Badge>
                      <p className="text-sm">Connect your Sui wallet</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">2</Badge>
                      <p className="text-sm">Set amount, recipients, and expiry</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">3</Badge>
                      <p className="text-sm">Add optional message</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">4</Badge>
                      <p className="text-sm">Share the 6-character ID</p>
                    </div>
                  </CardContent>
                </GradientCard>

                <GradientCard>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Gift className="h-5 w-5 text-primary" />
                      Claiming Airdrops
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">1</Badge>
                      <p className="text-sm">Get the droplet ID</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">2</Badge>
                      <p className="text-sm">Connect your wallet</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">3</Badge>
                      <p className="text-sm">Enter ID and name</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1 text-xs">4</Badge>
                      <p className="text-sm">Claim instantly</p>
                    </div>
                  </CardContent>
                </GradientCard>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-6 sm:py-8 border-t border-border/30">
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Sui Drop Hub</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Built on Sui Network • Decentralized Airdrop Platform
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
            <span>Network: Testnet</span>
            <span className="hidden sm:inline">•</span>
            <span>Platform Fee: 1.3%</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
