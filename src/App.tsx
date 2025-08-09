import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletKitProvider } from '@mysten/wallet-kit';
import { EventNotificationProvider } from "@/components/EventNotificationProvider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <WalletKitProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <EventNotificationProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </EventNotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </WalletKitProvider>
);

export default App;
