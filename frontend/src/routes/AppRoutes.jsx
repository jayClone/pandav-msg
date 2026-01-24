import { BrowserRouter, Routes, Route } from "react-router-dom";
import Register from "@pages/Register";
import Login from "@pages/Login";
import Chat from "@pages/Chat";
import GroupChat from "@pages/GroupChat";
import { ProtectedRoute } from "@routes/ProtectedRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/groupchat" element={<GroupChat />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/groupchat"
          element={
            <ProtectedRoute>
              <GroupChat />
            </ProtectedRoute>
          }
        /> */}
      </Routes>
    </BrowserRouter>
  );
}
