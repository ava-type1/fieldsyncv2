import { SyncStatusBadge } from '../ui/SyncStatus';

export function Header() {
  return (
    <header className="bg-gray-900/95 backdrop-blur-lg border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 pt-safe">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">FS</span>
        </div>
        <h1 className="text-lg font-bold text-gray-100">FieldSync</h1>
      </div>
      <SyncStatusBadge />
    </header>
  );
}
