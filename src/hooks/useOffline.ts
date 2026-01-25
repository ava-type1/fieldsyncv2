import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from '../lib/sync';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event) => {
      if (event.type === 'sync-start') {
        setIsSyncing(true);
      } else if (event.type === 'sync-complete' || event.type === 'sync-error') {
        setIsSyncing(false);
      }
    });

    return unsubscribe;
  }, []);

  // Poll for pending count
  useEffect(() => {
    const checkPending = async () => {
      const count = await syncEngine.getPendingCount();
      setPendingCount(count);
    };

    const interval = setInterval(checkPending, 2000);
    checkPending();

    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    await syncEngine.processQueue();
  }, []);

  const retryFailed = useCallback(async () => {
    await syncEngine.retryFailed();
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    triggerSync,
    retryFailed,
  };
}
