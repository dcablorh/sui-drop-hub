import { useEffect, useRef } from 'react';
import { suiClient, PACKAGE_ID, MODULE } from '@/lib/suiClient';

// Optimized polling hook for Sui Move events from our package/module
// Calls onEvents with any new events; keeps a cursor to avoid duplicates
// Reduced polling interval for faster dashboard updates
export function useSuiEvents(onEvents?: (events: any[]) => void, pollMs: number = 3000) {
  const cursorRef = useRef<any>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const poll = async () => {
      try {
        const res: any = await suiClient.queryEvents({
          query: { MoveModule: { package: PACKAGE_ID as any, module: MODULE as any } } as any,
          cursor: cursorRef.current || undefined,
          limit: 50, // Increased limit for better batching
          order: 'descending', // Get latest events first
        });

        if (!mounted.current) return;

        const events = res?.data ?? [];
        if (events.length > 0) {
          // Update cursor to the last event returned
          cursorRef.current = res.nextCursor ?? events[events.length - 1]?.id ?? cursorRef.current;
          onEvents?.(events);
        }
      } catch (e) {
        // Silent fail; next tick will retry
        // console.debug('Event poll error', e);
      }
    };

    // Initial kick and interval
    poll();
    const id = setInterval(poll, pollMs);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEvents, pollMs]);
}
