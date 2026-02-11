import { useState, useEffect } from 'react';

// Simplified sync status for offline-first personal app
// No Supabase dependency - just shows online/offline status

export function SyncStatus({ compact = false, className = '' }: { compact?: boolean; expandable?: boolean; className?: string }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  if (compact) {
    return (
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500 animate-pulse'} ${className}`} />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isOnline
        ? 'bg-green-500/10 text-green-400'
        : 'bg-amber-500/10 text-amber-400'
    } ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

export function SyncStatusBadge({ className = '' }: { className?: string }) {
  return <SyncStatus compact={false} className={className} />;
}

export function SyncToast() {
  return null; // Simplified - no toast needed for personal app
}

export default SyncStatus;
