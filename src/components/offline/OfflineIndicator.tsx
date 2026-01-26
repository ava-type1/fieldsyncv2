import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface PendingItem {
  id: string;
  type: 'photo' | 'signature' | 'checklist' | 'form';
  description: string;
  timestamp: number;
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online
      syncPendingItems();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending items from localStorage
    loadPendingItems();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPendingItems = () => {
    try {
      const stored = localStorage.getItem('fieldsync_pending_sync');
      if (stored) {
        setPendingItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading pending items:', e);
    }
  };

  const syncPendingItems = async () => {
    if (pendingItems.length === 0 || !navigator.onLine) return;
    
    setSyncing(true);
    
    // Simulate syncing - in production this would actually upload the items
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear synced items
    localStorage.removeItem('fieldsync_pending_sync');
    setPendingItems([]);
    setSyncing(false);
  };

  // Don't show anything if online and no pending items
  if (isOnline && pendingItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all ${
          isOnline 
            ? pendingItems.length > 0 
              ? 'bg-yellow-500 text-white'
              : 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        {syncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : isOnline ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        
        {!isOnline && <span className="text-sm font-medium">Offline</span>}
        {isOnline && pendingItems.length > 0 && (
          <span className="text-sm font-medium">{pendingItems.length} pending</span>
        )}
      </button>

      {/* Details panel */}
      {showDetails && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowDetails(false)}>
          <div 
            className="absolute top-16 right-4 w-80 bg-white rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-4 py-3 ${isOnline ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                <span className="font-medium">
                  {isOnline ? 'Connected' : 'Offline Mode'}
                </span>
              </div>
              <p className="text-sm text-white/80 mt-1">
                {isOnline 
                  ? 'Your changes sync automatically'
                  : 'Changes will sync when back online'
                }
              </p>
            </div>

            {/* Pending items */}
            {pendingItems.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Pending Sync ({pendingItems.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingItems.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {isOnline && (
                  <button
                    onClick={syncPendingItems}
                    disabled={syncing}
                    className="w-full mt-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Sync Now
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Success state */}
            {pendingItems.length === 0 && isOnline && (
              <div className="p-4 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">All changes synced!</p>
              </div>
            )}

            {/* Offline tips */}
            {!isOnline && (
              <div className="p-4 border-t bg-gray-50">
                <p className="text-xs text-gray-500">
                  💡 You can still take photos, fill checklists, and capture signatures. 
                  Everything will sync automatically when you're back online.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Helper function to add items to sync queue
export function addToSyncQueue(item: Omit<PendingItem, 'id' | 'timestamp'>) {
  try {
    const stored = localStorage.getItem('fieldsync_pending_sync');
    const items: PendingItem[] = stored ? JSON.parse(stored) : [];
    
    const newItem: PendingItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    items.push(newItem);
    localStorage.setItem('fieldsync_pending_sync', JSON.stringify(items));
    
    // Dispatch event so indicator updates
    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
    
    return newItem.id;
  } catch (e) {
    console.error('Error adding to sync queue:', e);
    return null;
  }
}
