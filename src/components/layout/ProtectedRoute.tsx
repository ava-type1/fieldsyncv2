import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

// No auth gate — personal use app
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
