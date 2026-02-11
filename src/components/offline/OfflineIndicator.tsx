import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className={`fixed top-16 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
      isOnline ? 'bg-green-900/90 text-green-200' : 'bg-amber-900/90 text-amber-200'
    }`}>
      {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
      <div className="flex-1">
        <p className="text-sm font-medium">
          {isOnline ? 'Back online' : 'You\'re offline'}
        </p>
        <p className="text-xs opacity-70">
          {isOnline ? 'Your data is saved locally' : 'Everything still works — data saves locally'}
        </p>
      </div>
      <button onClick={() => setShowBanner(false)} className="text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export function addToSyncQueue(item: { type: string; description: string }) {
  // Stub for compatibility
  return null;
}
