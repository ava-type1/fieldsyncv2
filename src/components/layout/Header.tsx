import { SyncStatus } from '../ui/SyncStatus';

export function Header() {
  return (
    <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 pt-safe">
      <h1 className="text-lg font-semibold text-gray-900">FieldSync</h1>
      <SyncStatus />
    </header>
  );
}
