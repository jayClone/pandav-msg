import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Register from "@pages/Register";
import Login from "@pages/Login";
import Layoute from "@/pages/Layoute";
import { ProtectedRoute } from "@routes/ProtectedRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
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
    </BrowserRouter>
  );
}
