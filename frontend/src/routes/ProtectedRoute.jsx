import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import authService from "@services/auth.service";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [loading, setLoading] = useState(() => !authService.isAuthenticated());

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        if (!authService.isAuthenticated()) {
          await authService.refreshSession();
        }

        const response = await authService.getCurrentUser();

        if (isMounted) {
          setIsAuthenticated(Boolean(response.success));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading && isAuthenticated) {
    return children;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
