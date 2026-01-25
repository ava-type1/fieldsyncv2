import { useState, useEffect, useCallback, useRef } from 'react';
import { syncEngine, SyncEvent } from '../lib/sync';

export interface OfflineState {
  /** Whether the device has network connectivity */
  isOnline: boolean;
  /** Whether we have confirmed connectivity to the backend */
  hasBackendAccess: boolean;
  /** Number of items waiting to be synced */
  pendingCount: number;
  /** Number of items that failed to sync */
  failedCount: number;
  /** Whether a sync operation is in progress */
  isSyncing: boolean;
  /** Timestamp of the last successful sync */
  lastSyncAt: Date | null;
  /** Last sync error message */
  lastError: string | null;
}

export interface UseOfflineResult extends OfflineState {
  /** Manually trigger a sync */
  triggerSync: () => Promise<void>;
  /** Retry all failed items */
  retryFailed: () => Promise<void>;
  /** Clear all failed items from the queue */
  clearFailed: () => Promise<void>;
  /** Check if a specific operation can be performed */
  canSync: boolean;
}

/**
 * Hook for managing offline state and sync operations.
 * Provides reactive state for UI components and actions for triggering syncs.
 */
export function useOffline(): UseOfflineResult {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasBackendAccess: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
  });

  const mountedRef = useRef(true);

  // Safe state update
  const safeSetState = useCallback((updates: Partial<OfflineState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      safeSetState({ isOnline: true });
    };

    const handleOffline = () => {
      safeSetState({ isOnline: false, hasBackendAccess: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [safeSetState]);

  // Subscribe to sync engine events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-start':
          safeSetState({ isSyncing: true, lastError: null });
          break;

        case 'sync-complete':
          safeSetState({
            isSyncing: false,
            lastSyncAt: new Date(),
            hasBackendAccess: true,
          });
          break;

        case 'sync-error':
          safeSetState({
            isSyncing: false,
            lastError: event.error || event.message || 'Sync failed',
          });
          break;

        case 'connection-restored':
          safeSetState({ isOnline: true, hasBackendAccess: true });
          break;

        case 'connection-lost':
          safeSetState({ isOnline: false, hasBackendAccess: false });
          break;
      }
    });

    return unsubscribe;
  }, [safeSetState]);

  // Poll for counts
  useEffect(() => {
    const updateCounts = async () => {
      try {
        const [pending, failed] = await Promise.all([
          syncEngine.getPendingCount(),
          syncEngine.getFailedCount(),
        ]);
        safeSetState({ pendingCount: pending, failedCount: failed });
      } catch (error) {
        console.error('Error fetching sync counts:', error);
      }
    };

    // Initial fetch
    updateCounts();

    // Poll every 3 seconds
    const interval = setInterval(updateCounts, 3000);

    return () => clearInterval(interval);
  }, [safeSetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Actions
  const triggerSync = useCallback(async () => {
    if (!state.isOnline) {
      safeSetState({ lastError: 'Cannot sync while offline' });
      return;
    }
    
    try {
      await syncEngine.processQueue();
    } catch (error) {
      safeSetState({
        lastError: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }, [state.isOnline, safeSetState]);

  const retryFailed = useCallback(async () => {
    if (!state.isOnline) {
      safeSetState({ lastError: 'Cannot retry while offline' });
      return;
    }

    try {
      await syncEngine.retryFailed();
    } catch (error) {
      safeSetState({
        lastError: error instanceof Error ? error.message : 'Retry failed',
      });
    }
  }, [state.isOnline, safeSetState]);

  const clearFailed = useCallback(async () => {
    try {
      await syncEngine.clearFailed();
      // Refresh counts
      const [pending, failed] = await Promise.all([
        syncEngine.getPendingCount(),
        syncEngine.getFailedCount(),
      ]);
      safeSetState({ pendingCount: pending, failedCount: failed });
    } catch (error) {
      safeSetState({
        lastError: error instanceof Error ? error.message : 'Clear failed',
      });
    }
  }, [safeSetState]);

  return {
    ...state,
    triggerSync,
    retryFailed,
    clearFailed,
    canSync: state.isOnline && !state.isSyncing,
  };
}

/**
 * Simplified hook that returns just the online status.
 * Useful for components that only need to know if we're online.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also subscribe to sync engine for more accurate status
    const unsubscribe = syncEngine.subscribe((event) => {
      if (event.type === 'connection-restored') {
        setIsOnline(true);
      } else if (event.type === 'connection-lost') {
        setIsOnline(false);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return isOnline;
}

/**
 * Hook for determining if there are pending changes that need to sync.
 * Useful for showing "unsaved changes" warnings.
 */
export function useHasPendingChanges(): boolean {
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    const check = async () => {
      const count = await syncEngine.getPendingCount();
      setHasPending(count > 0);
    };

    check();

    // Subscribe to relevant events
    const unsubscribe = syncEngine.subscribe((event) => {
      if (
        event.type === 'operation-queued' ||
        event.type === 'operation-complete' ||
        event.type === 'sync-complete'
      ) {
        check();
      }
    });

    return unsubscribe;
  }, []);

  return hasPending;
}

/**
 * Hook for showing a "leaving page" warning when there are pending changes.
 */
export function usePreventNavigation(when: boolean = true) {
  const hasPending = useHasPendingChanges();
  const shouldPrevent = when && hasPending;

  useEffect(() => {
    if (!shouldPrevent) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes that haven\'t synced yet. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldPrevent]);

  return shouldPrevent;
}

export default useOffline;
