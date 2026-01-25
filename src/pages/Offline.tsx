import { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, Database, CheckCircle2, Home, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { db } from '../lib/db';

interface CachedData {
  properties: number;
  phases: number;
  photos: number;
  pendingSync: number;
}

export function Offline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);

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

  // Check cached data on mount
  useEffect(() => {
    async function checkCachedData() {
      try {
        const [properties, phases, photos, pendingSync] = await Promise.all([
          db.properties.count(),
          db.phases.count(),
          db.photos.count(),
          db.syncQueue.count(),
        ]);
        setCachedData({ properties, phases, photos, pendingSync });
      } catch {
        // IndexedDB might not be available
        setCachedData(null);
      }
    }
    checkCachedData();
  }, []);

  // Redirect to home if back online
  useEffect(() => {
    if (isOnline) {
      // Small delay to allow connection to stabilize
      const timeout = setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/favicon.svg', {
        method: 'HEAD',
        cache: 'no-store',
      });
      if (response.ok) {
        window.location.href = '/';
      }
    } catch {
      // Still offline
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const handleGoHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  if (isOnline) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Connection restored, redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8 text-gray-400" />
          </div>

          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            You're offline
          </h1>
          <p className="mt-2 text-gray-600">
            Don't worry, you can still access your cached data and any changes will sync when you're back online.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={handleRetry}
              loading={isRetrying}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Try reconnecting
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleGoHome}
            >
              <Home className="w-5 h-5 mr-2" />
              Go to cached data
            </Button>
          </div>
        </div>

        {/* Cached data card */}
        {cachedData && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
              <Database className="w-4 h-4 text-primary-600" />
              Available offline
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-gray-900">
                  {cachedData.properties}
                </div>
                <div className="text-sm text-gray-600">Properties</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-gray-900">
                  {cachedData.phases}
                </div>
                <div className="text-sm text-gray-600">Phases</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-gray-900">
                  {cachedData.photos}
                </div>
                <div className="text-sm text-gray-600">Photos</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-semibold text-gray-900">
                    {cachedData.pendingSync}
                  </span>
                  {cachedData.pendingSync > 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      pending
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">To sync</div>
              </div>
            </div>
            {cachedData.pendingSync > 0 && (
              <div className="mt-3 flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Your changes are safely stored and will automatically sync when you reconnect.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Tip: Enable airplane mode OFF and check your WiFi or cellular connection</p>
        </div>
      </div>
    </div>
  );
}
