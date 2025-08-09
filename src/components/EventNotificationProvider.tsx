import { createContext, useContext, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSuiEvents } from '@/hooks/useSuiEvents';
import { Gift, Send, Settings, TrendingUp } from 'lucide-react';

interface EventNotificationContextType {
  // This context provides global event notifications
}

const EventNotificationContext = createContext<EventNotificationContextType>({});

export const useEventNotifications = () => useContext(EventNotificationContext);

interface EventNotificationProviderProps {
  children: ReactNode;
}

export function EventNotificationProvider({ children }: EventNotificationProviderProps) {
  const { toast } = useToast();

  // Listen for all contract events and show relevant notifications
  useSuiEvents((events) => {
    events.forEach((event) => {
      try {
        const eventType = event.type;
        const data = event.parsedJson;

        if (!data) return;

        if (eventType.includes('DropletCreated')) {
          toast({
            title: "🚀 New Droplet Created!",
            description: `Droplet ${data.droplet_id} created with ${(data.net_amount / 1e9).toFixed(4)} SUI`,
            duration: 4000,
          });
        } 
        
        else if (eventType.includes('DropletClaimed')) {
          const message = data.message ? ` • "${data.message}"` : '';
          toast({
            title: "💰 Airdrop Claimed!",
            description: `${data.claimer_name} claimed ${(data.claim_amount / 1e9).toFixed(4)} SUI from ${data.droplet_id}${message}`,
            duration: 5000,
          });
        }
        
        else if (eventType.includes('DropletClosed')) {
          const reason = data.reason === 'completed' ? 'All tokens claimed!' : 'Droplet expired';
          toast({
            title: "📋 Droplet Closed",
            description: `${data.droplet_id}: ${reason} • ${data.num_claimers} claims made`,
            duration: 4000,
          });
        }
        
        else if (eventType.includes('FeePercentageUpdated')) {
          toast({
            title: "⚙️ Platform Fee Updated",
            description: `Fee changed from ${(data.old_fee / 100).toFixed(1)}% to ${(data.new_fee / 100).toFixed(1)}%`,
            duration: 4000,
          });
        }
      } catch (error) {
        // Silent fail for parsing errors
        console.debug('Event notification error:', error);
      }
    });
  });

  return (
    <EventNotificationContext.Provider value={{}}>
      {children}
    </EventNotificationContext.Provider>
  );
}