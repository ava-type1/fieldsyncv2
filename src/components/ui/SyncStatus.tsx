import { useState } from 'react';
import { useSync, useSyncNotifications } from '../../hooks/useSync';

// Icons as inline SVG for zero dependencies
const CloudIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const CloudOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

interface SyncStatusProps {
  /** Compact mode - shows only the icon/badge */
  compact?: boolean;
  /** Show detailed breakdown on click */
  expandable?: boolean;
  /** Custom class name */
  className?: string;
}

export function SyncStatus({ compact = false, expandable = true, className = '' }: SyncStatusProps) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    conflictCount,
    lastSyncAt,
    lastError,
    syncProgress,
    photoUploadProgress,
    triggerSync,
    retryFailed,
    clearFailed,
  } = useSync();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  // Format relative time
  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Determine status
  const getStatus = () => {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    if (failedCount > 0) return 'error';
    if (conflictCount > 0) return 'conflict';
    if (pendingCount > 0) return 'pending';
    return 'synced';
  };

  const status = getStatus();

  // Status colors and icons
  const statusConfig = {
    offline: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      icon: CloudOffIcon,
      label: 'Offline',
    },
    syncing: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      icon: RefreshIcon,
      label: 'Syncing',
    },
    error: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      dot: 'bg-red-500',
      icon: AlertIcon,
      label: 'Sync Error',
    },
    conflict: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      dot: 'bg-orange-500',
      icon: AlertIcon,
      label: 'Conflicts',
    },
    pending: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      icon: UploadIcon,
      label: 'Pending',
    },
    synced: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      dot: 'bg-green-500',
      icon: CheckIcon,
      label: 'Synced',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Compact view
  if (compact) {
    return (
      <button
        onClick={() => expandable && setIsExpanded(!isExpanded)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full ${config.bg} ${config.text} transition-colors ${className}`}
        title={`${config.label}${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      >
        <Icon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
        {(pendingCount > 0 || failedCount > 0 || conflictCount > 0) && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${
            failedCount > 0 ? 'bg-red-500' : conflictCount > 0 ? 'bg-orange-500' : 'bg-blue-500'
          } text-white text-xs flex items-center justify-center font-medium`}>
            {failedCount || conflictCount || pendingCount}
          </span>
        )}
      </button>
    );
  }

  // Full view
  return (
    <div className={`relative ${className}`}>
      {/* Main status badge */}
      <button
        onClick={() => expandable && setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} transition-all ${
          expandable ? 'hover:shadow-sm cursor-pointer' : ''
        }`}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full ${config.dot} ${
          (isSyncing || status === 'pending') ? 'animate-pulse' : ''
        }`} />
        
        {/* Icon for syncing */}
        {isSyncing && (
          <RefreshIcon className="w-4 h-4 animate-spin" />
        )}

        {/* Label */}
        <span className="text-sm font-medium">
          {status === 'offline' && 'Offline'}
          {status === 'syncing' && (syncProgress 
            ? `Syncing (${syncProgress.processed}/${syncProgress.total})`
            : 'Syncing...'
          )}
          {status === 'error' && `${failedCount} Failed`}
          {status === 'conflict' && `${conflictCount} Conflict${conflictCount > 1 ? 's' : ''}`}
          {status === 'pending' && `${pendingCount} Pending`}
          {status === 'synced' && 'All Synced'}
        </span>

        {/* Expand indicator */}
        {expandable && (
          <svg 
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Photo upload progress */}
      {photoUploadProgress && (
        <div className="absolute top-full left-0 right-0 mt-1">
          <div className="bg-blue-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${(photoUploadProgress.progress / photoUploadProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-0.5 text-center">
            Uploading photo... {Math.round((photoUploadProgress.progress / photoUploadProgress.total) * 100)}%
          </p>
        </div>
      )}

      {/* Expanded details panel */}
      {isExpanded && expandable && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className={`px-4 py-3 ${config.bg} border-b ${config.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${config.text} ${isSyncing ? 'animate-spin' : ''}`} />
                <span className={`font-medium ${config.text}`}>{config.label}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pending changes</span>
              <span className={pendingCount > 0 ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                {pendingCount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Failed items</span>
              <span className={failedCount > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                {failedCount}
              </span>
            </div>
            {conflictCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Conflicts</span>
                <span className="text-orange-600 font-medium">{conflictCount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last synced</span>
              <span className="text-gray-700">{formatLastSync(lastSyncAt)}</span>
            </div>
          </div>

          {/* Error message */}
          {lastError && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-600 line-clamp-2">{lastError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
            {/* Sync button */}
            <button
              onClick={(e) => { e.stopPropagation(); triggerSync(); }}
              disabled={!isOnline || isSyncing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isOnline || isSyncing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>

            {/* Retry failed */}
            {failedCount > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    retryFailed(); 
                  }}
                  disabled={!isOnline}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !isOnline
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  Retry Failed
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowRetryConfirm(true); 
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Offline message */}
            {!isOnline && (
              <p className="text-xs text-center text-gray-500">
                Changes will sync automatically when you're back online
              </p>
            )}
          </div>

          {/* Confirm clear dialog */}
          {showRetryConfirm && (
            <div className="absolute inset-0 bg-white flex flex-col">
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <AlertIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Clear failed items?</h3>
                  <p className="text-sm text-gray-500">
                    This will remove {failedCount} failed item{failedCount > 1 ? 's' : ''} from the sync queue. 
                    These changes will be lost.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-gray-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRetryConfirm(false); }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    clearFailed(); 
                    setShowRetryConfirm(false); 
                  }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

// Minimal inline status (for use in headers/footers)
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { isOnline, pendingCount, isSyncing, failedCount } = useSync();

  if (!isOnline) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Offline
      </span>
    );
  }

  if (failedCount > 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {failedCount} failed
      </span>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        {isSyncing ? 'Syncing' : `${pendingCount} pending`}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Synced
    </span>
  );
}

// Toast notification component for sync events
export function SyncToast() {
  const { notification, dismissNotification } = useSyncNotifications();

  if (!notification) return null;

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg border shadow-lg ${typeStyles[notification.type]} animate-slide-up z-50`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
        <div className="flex items-center gap-2">
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="text-sm font-medium underline hover:no-underline"
            >
              {notification.action.label}
            </button>
          )}
          <button
            onClick={dismissNotification}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Add animation keyframes via style tag
if (typeof document !== 'undefined') {
  const styleId = 'sync-status-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slide-up {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      .animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
  }
}

export default SyncStatus;
