import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy , Suspense} from "react";
import Index from "@/pages/Index";

// ✅ LAZY LOAD HEAVY PAGES
const Register = lazy(() => import("@pages/Register"));
const Login = lazy(() => import("@pages/Login"));
const Layoute = lazy(() => import("@/pages/Layoute"));

// ✅ FALLBACK LOADING COMPONENT
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ✅ WRAPPED WITH SUSPENSE */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Layoute initialTab="chats" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groupchat"
            element={
              <ProtectedRoute>
                <Layoute initialTab="groups" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

import { ProtectedRoute } from "@routes/ProtectedRoute";
