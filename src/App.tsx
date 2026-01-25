import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
import { Onboarding } from './pages/auth/Onboarding';
import { PropertyList } from './pages/properties/PropertyList';
import { PropertyDetail } from './pages/properties/PropertyDetail';
import { WalkthroughForm } from './pages/service/WalkthroughForm';
import { MaterialsList } from './pages/materials/MaterialsList';
import { Dashboard } from './pages/manager/Dashboard';
import { ReviewWalkthrough } from './pages/manager/ReviewWalkthrough';
import { MapView } from './pages/map/MapView';

export default function App() {
  useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Onboarding - requires auth but not org */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOrg={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Protected routes - require auth and org */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<PropertyList />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/property/:id/walkthrough" element={<WalkthroughForm />} />
        <Route path="/materials" element={<MaterialsList />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/review/:id" element={<ReviewWalkthrough />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
