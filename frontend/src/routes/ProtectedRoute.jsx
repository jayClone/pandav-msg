import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import authService from "@services/auth.service";

export function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        
        if (!token) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        // ✅ FIXED: Use /auth/me instead of /auth/current
        const response = await authService.getCurrentUser();
        
        if (response.success) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("❌ Auth check failed:", error.message);
        localStorage.removeItem("token");
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

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

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}