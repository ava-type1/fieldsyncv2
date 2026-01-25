import { useOffline } from '../../hooks/useOffline';

export function SyncStatus() {
  const { isOnline, pendingCount } = useOffline();

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        Offline
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        Syncing ({pendingCount})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
      <span className="w-2 h-2 bg-green-500 rounded-full" />
      Synced
    </div>
  );
}
