import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import authService from "@services/auth.service";

const hasUsableToken = () => {
  const token = authService.getToken();

  if (!token) {
    return false;
  }

  try {
    const decoded = jwtDecode(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : null;

    if (expiresAt && expiresAt <= Date.now()) {
      localStorage.removeItem("token");
      return false;
    }

    return true;
  } catch {
    localStorage.removeItem("token");
    return false;
  }
};

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasUsableToken());
  const [loading, setLoading] = useState(() => hasUsableToken());

  useEffect(() => {
    const token = authService.getToken();

    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const checkAuth = async () => {
      try {
        const response = await authService.getCurrentUser();

        if (isMounted) {
          setIsAuthenticated(Boolean(response.success));
        }
      } catch (error) {
        console.error("Auth check failed:", error.message);
        localStorage.removeItem("token");

        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

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
