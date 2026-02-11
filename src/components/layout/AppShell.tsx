import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { OfflineIndicator } from '../offline/OfflineIndicator';

export function AppShell() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
      <OfflineIndicator />
    </div>
  );
}
