import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading, isGlobalAdmin, isAdminCheckPending } = useAuth();

  if (isLoading || (user && isAdminCheckPending)) {
    return (
      <main className="app-main">
        <div className="admin-loading">Checking permissions…</div>
      </main>
    );
  }

  if (!user || !isGlobalAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
