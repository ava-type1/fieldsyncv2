import { useState, useEffect, useCallback } from 'react';
import { syncEngine, SyncEvent } from '../lib/sync';

interface UseSyncResult {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  triggerSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearFailed: () => Promise<void>;
}

export function useSync(): UseSyncResult {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      syncEngine.processQueue().catch(console.error);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-start':
          setIsSyncing(true);
          setLastError(null);
          break;

        case 'sync-complete':
          setIsSyncing(false);
          setLastSyncAt(new Date());
          break;

        case 'sync-error':
          setIsSyncing(false);
          setLastError(event.error || 'Sync failed');
          break;

        case 'operation-queued':
          setPendingCount((prev) => prev + 1);
          break;

        case 'operation-complete':
          setPendingCount((prev) => Math.max(0, prev - 1));
          break;

        case 'operation-failed':
          setPendingCount((prev) => Math.max(0, prev - 1));
          setFailedCount((prev) => prev + 1);
          break;

        case 'conflict':
          // Server wins, notify user
          console.warn('Sync conflict:', event.details);
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Poll for counts periodically
  useEffect(() => {
    const updateCounts = async () => {
      const pending = await syncEngine.getPendingCount();
      const failed = await syncEngine.getFailedCount();
      setPendingCount(pending);
      setFailedCount(failed);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000);

    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      setLastError('Cannot sync while offline');
      return;
    }

    try {
      await syncEngine.processQueue();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Sync failed');
    }
  }, [isOnline]);

  const retryFailed = useCallback(async () => {
    if (!isOnline) {
      setLastError('Cannot retry while offline');
      return;
    }

    try {
      await syncEngine.retryFailed();
      setFailedCount(0);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Retry failed');
    }
  }, [isOnline]);

  const clearFailed = useCallback(async () => {
    await syncEngine.clearFailed();
    setFailedCount(0);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncAt,
    lastError,
    triggerSync,
    retryFailed,
    clearFailed,
  };
}

// Hook for showing sync notifications
export function useSyncNotifications() {
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-complete':
          setNotification({
            type: 'success',
            message: 'All changes synced',
          });
          setTimeout(() => setNotification(null), 3000);
          break;

        case 'sync-error':
          setNotification({
            type: 'error',
            message: event.error || 'Failed to sync changes',
          });
          break;

        case 'conflict':
          setNotification({
            type: 'warning',
            message: 'Your changes were overwritten by a newer version',
          });
          break;
      }
    });

    return unsubscribe;
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return { notification, dismissNotification };
}
