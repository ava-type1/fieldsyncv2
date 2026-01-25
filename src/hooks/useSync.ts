import { useState, useEffect, useCallback, useRef } from 'react';
import { syncEngine, SyncEvent } from '../lib/sync';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  syncProgress: {
    processed: number;
    total: number;
    currentItem?: string;
  } | null;
  photoUploadProgress: {
    localId: string;
    progress: number;
    total: number;
  } | null;
}

export interface UseSyncResult extends SyncState {
  triggerSync: () => Promise<void>;
  forceSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
  retryItem: (itemId: number) => Promise<void>;
  clearFailed: () => Promise<void>;
  clearItem: (itemId: number) => Promise<void>;
  getFailedItems: () => Promise<Array<{
    id: number;
    table: string;
    type: string;
    error?: string;
    attempts: number;
    createdAt: Date;
  }>>;
  getConflicts: () => Promise<Array<{
    id: number;
    table: string;
    localId: string;
    conflictedAt: Date;
  }>>;
  applyConflictDraft: (draftId: number) => Promise<void>;
  discardConflictDraft: (draftId: number) => Promise<void>;
}

export function useSync(): UseSyncResult {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
    lastError: null,
    syncProgress: null,
    photoUploadProgress: null,
  });

  const mountedRef = useRef(true);
  const updateCountsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safely update state only if mounted
  const safeSetState = useCallback((updates: Partial<SyncState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Update counts from database
  const updateCounts = useCallback(async () => {
    try {
      const [pending, failed, conflicts] = await Promise.all([
        syncEngine.getPendingCount(),
        syncEngine.getFailedCount(),
        syncEngine.hasConflicts().then(async (has) => {
          if (!has) return 0;
          const drafts = await syncEngine.getConflictDrafts();
          return drafts.filter(d => !d.resolved).length;
        }),
      ]);
      
      safeSetState({
        pendingCount: pending,
        failedCount: failed,
        conflictCount: conflicts,
      });
    } catch (error) {
      console.error('Error updating sync counts:', error);
    }
  }, [safeSetState]);

  // Debounced count update
  const debouncedUpdateCounts = useCallback(() => {
    if (updateCountsTimeoutRef.current) {
      clearTimeout(updateCountsTimeoutRef.current);
    }
    updateCountsTimeoutRef.current = setTimeout(updateCounts, 100);
  }, [updateCounts]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      safeSetState({ isOnline: true, lastError: null });
    };

    const handleOffline = () => {
      safeSetState({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [safeSetState]);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-start':
          safeSetState({
            isSyncing: true,
            lastError: null,
            syncProgress: { processed: 0, total: 0 },
          });
          break;

        case 'sync-complete':
          safeSetState({
            isSyncing: false,
            lastSyncAt: new Date(),
            syncProgress: null,
          });
          debouncedUpdateCounts();
          break;

        case 'sync-error':
          safeSetState({
            isSyncing: false,
            lastError: event.error || event.message || 'Sync failed',
            syncProgress: null,
          });
          debouncedUpdateCounts();
          break;

        case 'sync-progress':
          if (event.details) {
            safeSetState({
              syncProgress: {
                processed: event.details.processed as number,
                total: (event.details.processed as number) + (event.details.remaining as number),
                currentItem: event.message,
              },
            });
          }
          break;

        case 'operation-queued':
          debouncedUpdateCounts();
          break;

        case 'operation-complete':
          debouncedUpdateCounts();
          break;

        case 'operation-failed':
          debouncedUpdateCounts();
          break;

        case 'conflict':
        case 'conflict-resolved':
          debouncedUpdateCounts();
          break;

        case 'connection-restored':
          safeSetState({ isOnline: true, lastError: null });
          break;

        case 'connection-lost':
          safeSetState({ isOnline: false });
          break;

        case 'photo-upload-progress':
          if (event.details) {
            safeSetState({
              photoUploadProgress: {
                localId: event.details.localId as string,
                progress: event.details.progress as number,
                total: event.details.total as number,
              },
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [safeSetState, debouncedUpdateCounts]);

  // Initial count load and periodic refresh
  useEffect(() => {
    updateCounts();
    
    // Refresh counts periodically (every 10 seconds when not syncing)
    const interval = setInterval(() => {
      if (!state.isSyncing) {
        updateCounts();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (updateCountsTimeoutRef.current) {
        clearTimeout(updateCountsTimeoutRef.current);
      }
    };
  }, [updateCounts, state.isSyncing]);

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
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  }, [state.isOnline, safeSetState]);

  const forceSync = useCallback(async () => {
    try {
      await syncEngine.forcSync();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Force sync failed',
      });
    }
  }, [safeSetState]);

  const retryFailed = useCallback(async () => {
    if (!state.isOnline) {
      safeSetState({ lastError: 'Cannot retry while offline' });
      return;
    }

    try {
      await syncEngine.retryFailed();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Retry failed',
      });
    }
  }, [state.isOnline, safeSetState]);

  const retryItem = useCallback(async (itemId: number) => {
    if (!state.isOnline) {
      safeSetState({ lastError: 'Cannot retry while offline' });
      return;
    }

    try {
      await syncEngine.retryItem(itemId);
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Retry failed',
      });
    }
  }, [state.isOnline, safeSetState]);

  const clearFailed = useCallback(async () => {
    try {
      await syncEngine.clearFailed();
      debouncedUpdateCounts();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Clear failed',
      });
    }
  }, [safeSetState, debouncedUpdateCounts]);

  const clearItem = useCallback(async (itemId: number) => {
    try {
      await syncEngine.clearItem(itemId);
      debouncedUpdateCounts();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Clear failed',
      });
    }
  }, [safeSetState, debouncedUpdateCounts]);

  const getFailedItems = useCallback(async () => {
    const items = await syncEngine.getFailedItems();
    return items.map(item => ({
      id: item.id!,
      table: item.table,
      type: item.type,
      error: item.error,
      attempts: item.attempts,
      createdAt: item.createdAt,
    }));
  }, []);

  const getConflicts = useCallback(async () => {
    const drafts = await syncEngine.getConflictDrafts();
    return drafts
      .filter(d => !d.resolved)
      .map(d => ({
        id: d.id!,
        table: d.table,
        localId: d.localId,
        conflictedAt: d.conflictedAt,
      }));
  }, []);

  const applyConflictDraft = useCallback(async (draftId: number) => {
    try {
      await syncEngine.applyDraft(draftId);
      debouncedUpdateCounts();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Failed to apply draft',
      });
    }
  }, [safeSetState, debouncedUpdateCounts]);

  const discardConflictDraft = useCallback(async (draftId: number) => {
    try {
      await syncEngine.discardDraft(draftId);
      debouncedUpdateCounts();
    } catch (err) {
      safeSetState({
        lastError: err instanceof Error ? err.message : 'Failed to discard draft',
      });
    }
  }, [safeSetState, debouncedUpdateCounts]);

  return {
    ...state,
    triggerSync,
    forceSync,
    retryFailed,
    retryItem,
    clearFailed,
    clearItem,
    getFailedItems,
    getConflicts,
    applyConflictDraft,
    discardConflictDraft,
  };
}

// Hook for showing sync notifications (toast-style)
export function useSyncNotifications() {
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  } | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      switch (event.type) {
        case 'sync-complete':
          if (event.details?.pending === 0) {
            setNotification({
              type: 'success',
              message: 'All changes synced',
            });
            timeoutRef.current = setTimeout(() => setNotification(null), 3000);
          }
          break;

        case 'sync-error':
          setNotification({
            type: 'error',
            message: event.error || event.message || 'Failed to sync changes',
            action: {
              label: 'Retry',
              onClick: () => {
                syncEngine.processQueue();
                setNotification(null);
              },
            },
          });
          break;

        case 'conflict':
          setNotification({
            type: 'warning',
            message: 'Conflict detected. Your changes were saved as draft.',
            action: {
              label: 'View',
              onClick: () => {
                // Navigation would be handled by the app
                setNotification(null);
              },
            },
          });
          break;

        case 'connection-restored':
          setNotification({
            type: 'info',
            message: 'Back online. Syncing changes...',
          });
          timeoutRef.current = setTimeout(() => setNotification(null), 2000);
          break;

        case 'connection-lost':
          setNotification({
            type: 'warning',
            message: 'You\'re offline. Changes will sync when connected.',
          });
          timeoutRef.current = setTimeout(() => setNotification(null), 4000);
          break;

        case 'operation-failed':
          if (event.details?.attempts && (event.details.attempts as number) >= 5) {
            setNotification({
              type: 'error',
              message: `Failed to sync ${event.details.table}`,
              action: {
                label: 'View Details',
                onClick: () => setNotification(null),
              },
            });
          }
          break;
      }
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return { notification, dismissNotification };
}

// Hook for background sync registration (Service Worker)
export function useBackgroundSync() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        setIsSupported(true);
        
        try {
          const registration = await navigator.serviceWorker.ready;
          // Check if already registered
          // @ts-ignore - sync is not in the types
          const tags = await registration.sync?.getTags?.();
          setIsRegistered(tags?.includes('fieldsync-background'));
        } catch {
          // Background sync not available
        }
      }
    };

    checkSupport();
  }, []);

  const registerBackgroundSync = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-ignore
      await registration.sync?.register('fieldsync-background');
      setIsRegistered(true);
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  }, [isSupported]);

  return { isSupported, isRegistered, registerBackgroundSync };
}

// Convenience hook combining online status with sync state
export function useOfflineStatus() {
  const { isOnline, pendingCount, isSyncing } = useSync();
  
  return {
    isOnline,
    hasPendingChanges: pendingCount > 0,
    isSyncing,
    statusText: !isOnline 
      ? 'Offline' 
      : isSyncing 
        ? 'Syncing...' 
        : pendingCount > 0 
          ? `${pendingCount} pending` 
          : 'All synced',
  };
}
