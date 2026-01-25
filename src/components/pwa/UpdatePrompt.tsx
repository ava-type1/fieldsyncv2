import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service worker registered:', swUrl);
      
      // Check for updates periodically (every 30 minutes)
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
      <div className="bg-primary-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Update Available</h3>
            <p className="text-sm text-primary-100 mt-0.5">
              A new version of FieldSync is ready
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-primary-200 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="flex-1 text-white hover:bg-white/10"
          >
            Later
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUpdate}
            className="flex-1 bg-white text-primary-600 hover:bg-primary-50"
          >
            Update now
          </Button>
        </div>
      </div>
    </div>
  );
}
