import { WifiOff } from 'lucide-react';

export function Offline() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <WifiOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-200">You're offline</h1>
        <p className="text-gray-500 mt-2 max-w-sm">
          Don't worry — FieldSync works offline. Your jobs, photos, and data are all saved locally on your device.
        </p>
        <button
          onClick={() => window.location.href = '/jobs'}
          className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium"
        >
          Go to Jobs
        </button>
      </div>
    </div>
  );
}
