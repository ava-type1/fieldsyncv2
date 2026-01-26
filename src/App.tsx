import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
import { Onboarding } from './pages/auth/Onboarding';
import { LandingPage } from './pages/landing/LandingPage';
import { PropertyList } from './pages/properties/PropertyList';
import { PropertyDetail } from './pages/properties/PropertyDetail';
import { WalkthroughForm } from './pages/service/WalkthroughForm';
import { WalkthroughChecklist } from './pages/service/WalkthroughChecklist';
import { ReturnWorkOrder } from './pages/service/ReturnWorkOrder';
import { PayCalculator } from './pages/pay/PayCalculator';
import { MaterialsList } from './pages/materials/MaterialsList';
import { Dashboard } from './pages/manager/Dashboard';
import { ReviewWalkthrough } from './pages/manager/ReviewWalkthrough';
import { MapView } from './pages/map/MapView';
import { Settings } from './pages/settings/Settings';
import { ProfileSettings } from './pages/settings/ProfileSettings';
import { OrganizationSettings } from './pages/settings/OrganizationSettings';
import { TeamSettings } from './pages/settings/TeamSettings';
import { PortalLookup } from './pages/portal/PortalLookup';
import { CustomerPortal } from './pages/portal/CustomerPortal';
import { QuickBooksSettings } from './pages/settings/QuickBooksSettings';
import { BillingSettings } from './pages/settings/BillingSettings';
import { Offline } from './pages/Offline';
import { InstallPrompt, UpdatePrompt } from './components/pwa';

// Wrapper component that shows landing page for guests, app for logged-in users
function HomeRoute() {
  const { user, isInitialized } = useAuthStore();
  const { initializeAuth } = useAuth();

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized, initializeAuth]);

  // Show loading while auth initializes
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show landing page for guests
  if (!user) {
    return <LandingPage />;
  }

  // Redirect to app for logged-in users
  return <Navigate to="/properties" replace />;
}

export default function App() {
  useAuthStore();

  return (
    <>
      {/* PWA Install & Update Prompts */}
      <InstallPrompt />
      <UpdatePrompt />
      
      <Routes>
      {/* Landing page - shows marketing for guests, redirects to app for logged-in users */}
      <Route path="/" element={<HomeRoute />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/offline" element={<Offline />} />

      {/* Customer Portal - public, no auth required */}
      <Route path="/portal" element={<PortalLookup />} />
      <Route path="/portal/:code" element={<CustomerPortal />} />

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
        <Route path="/properties" element={<PropertyList />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/property/:id/walkthrough" element={<WalkthroughForm />} />
        <Route path="/property/:id/walkthrough-checklist" element={<WalkthroughChecklist />} />
        <Route path="/property/:id/return-work-order" element={<ReturnWorkOrder />} />
        <Route path="/materials" element={<MaterialsList />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/review/:id" element={<ReviewWalkthrough />} />
        <Route path="/pay" element={<PayCalculator />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/profile" element={<ProfileSettings />} />
        <Route path="/settings/organization" element={<OrganizationSettings />} />
        <Route path="/settings/team" element={<TeamSettings />} />
        <Route path="/settings/quickbooks" element={<QuickBooksSettings />} />
        <Route path="/settings/billing" element={<BillingSettings />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
