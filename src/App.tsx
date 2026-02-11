import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { JobsList } from './pages/jobs/JobsList';
import { JobDetail } from './pages/jobs/JobDetail';
import { ScanPage } from './pages/scan/ScanPage';
import { MapView } from './pages/map/MapView';
import { PayCalculator } from './pages/pay/PayCalculator';
import { Offline } from './pages/Offline';
import { InstallPrompt, UpdatePrompt } from './components/pwa';

export default function App() {
  return (
    <>
      {/* PWA Install & Update Prompts */}
      <InstallPrompt />
      <UpdatePrompt />
      
      <Routes>
        {/* Offline fallback */}
        <Route path="/offline" element={<Offline />} />

        {/* Main app - no auth required */}
        <Route element={<AppShell />}>
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/job/:id" element={<JobDetail />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/pay" element={<PayCalculator />} />
        </Route>

        {/* Root → Jobs */}
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        
        {/* Catch-all → Jobs */}
        <Route path="*" element={<Navigate to="/jobs" replace />} />
      </Routes>
    </>
  );
}
