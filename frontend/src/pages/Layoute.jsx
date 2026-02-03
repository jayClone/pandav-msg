import React, {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  disconnectSocket,
} from "@socket/socketClient.js";
import ThemeChanger from "@components/ThemeChanger";
import Chat from "./Chat";
import GroupChat from "./GroupChat";
import GroupChatErrorBoundary from '@components/GroupChatErrorBoundary';
import {
  MessageCircle,
  Users,
  Plus,
  Settings,
  LogOut,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Moon,
  Sun,
} from "lucide-react";

export default function Layoute({ initialTab = "chats" }) {
  const navigate = useNavigate();

  // Auth State
  const token = localStorage.getItem("token");
  let authState = { currentUserName: "", currentUserId: "" };
  if (token) {
    try {
      const decoded = jwtDecode(token);
      authState = {
        currentUserName: decoded.name,
        currentUserId: decoded.userId,
      };
    } catch {
      authState = { currentUserName: "", currentUserId: "" };
    }
  }
  const { currentUserName, currentUserId } = authState;

  // UI States
  const [activeTab, setActiveTab] = useState(initialTab);
  const [theme, ] = useState("dark");
  const [bgImage, setBgImage] = useState(() => {
    const savedTheme = localStorage.getItem("selectedTheme");
    return savedTheme || "default";
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSettings, ] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  // Background images with text colors and fonts
  const bgImages = {
    default: {
      bg: "linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)",
      textColor: "#e5e7eb",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      fontWeight: "500"
    },
    dark: {
      bg: "linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)",
      textColor: "#e5e7eb",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      fontWeight: "500"
    },
    forest: {
      bg: "linear-gradient(135deg, rgba(34,139,34,0.15) 0%, rgba(0,50,0,0.2) 100%)",
      textColor: "#111211",
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: "15px",
      fontWeight: "600"
    },
    ocean: {
      bg: "linear-gradient(135deg, #001a4d 0%, #003d99 50%, #0066cc 100%)",
      textColor: "#e0e7ff",
      fontFamily: "'Poppins', sans-serif",
      fontSize: "14px",
      fontWeight: "500"
    },
    sunset: {
      bg: "linear-gradient(135deg, #1a0033 0%, #330066 25%, #660099 50%, #cc6600 75%, #ff9900 100%)",
      textColor: "#fef3c7",
      fontFamily: "'Georgia', serif",
      fontSize: "16px",
      fontWeight: "600"
    },
    minimal: {
      bg: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
      textColor: "#d1d5db",
      fontFamily: "'Helvetica Neue', sans-serif",
      fontSize: "13px",
      fontWeight: "400"
    },
    night: {
      bg: "linear-gradient(135deg, #0d0221 0%, #14213d 100%)",
      textColor: "#cbd5e1",
      fontFamily: "'Roboto', sans-serif",
      fontSize: "15px",
      fontWeight: "500"
    },
  };

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("selectedTheme", bgImage);
  }, [bgImage]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* LEFT SIDEBAR - Navigation Icons */}
      <div className="hidden sm:flex sm:w-16 md:w-20 sm:glass-effect bg-[rgb(var(--bg-secondary))] sm:bg-transparent border-r border-[rgb(var(--border-secondary))] flex-col items-center py-3 sm:py-4 gap-4 sm:gap-6">
        <div
          className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg glow-green cursor-pointer hover:scale-110 transition-transform"
          title={currentUserName}
        >
          {currentUserName.charAt(0).toUpperCase()}
        </div>

        <nav className="flex flex-col gap-4">
          <button
            onClick={() => setActiveTab("chats")}
            className={`p-3 rounded-xl transition-all ${activeTab === "chats" ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]" : "text-gray-400 hover:text-green-400"}`}
            title="Chats"
          >
            <MessageCircle className="w-6 h-6" />
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`p-3 rounded-xl transition-all ${activeTab === "groups" ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]" : "text-gray-400 hover:text-green-400"}`}
            title="Groups"
          >
            <Users className="w-6 h-6" />
          </button>

          <button
            className="p-3 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400"
            title="Add Contact"
          >
            <Plus className="w-6 h-6" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button
            onClick={() => setShowThemeModal(true)}
            className="p-3 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400"
            title="Theme"
          >
            {theme === "dark" ? (
              <Moon className="w-6 h-6" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400"
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>

          <button
            onClick={handleLogout}
            className="p-3 hover:bg-red-500/20 rounded-xl transition-all text-gray-400 hover:text-red-400"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && !showThemeSettings && (
        <div className="p-4 bg-[rgb(var(--bg-secondary))]/50 border-r border-[rgb(var(--border-secondary))] space-y-2 animate-in slide-in-from-left w-56">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              Sound
            </span>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-10 h-6 rounded-full transition-all ${soundEnabled ? "bg-green-500" : "bg-gray-600"} relative`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${soundEnabled ? "right-1" : "left-1"}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              {notificationsEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
              Notifications
            </span>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`w-10 h-6 rounded-full transition-all ${notificationsEnabled ? "bg-green-500" : "bg-gray-600"} relative`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? "right-1" : "left-1"}`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Render Chat or GroupChat based on active tab */}
      {activeTab === "chats" ? (
        <Chat
          onlineUsers={[]}
          allUsers={allUsers}
          setAllUsers={setAllUsers}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
          theme={theme}
          bgImage={bgImage}
          bgImages={bgImages}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          notificationsEnabled={notificationsEnabled}
          setNotificationsEnabled={setNotificationsEnabled}
          token={token}
        />
      ) : (
        <GroupChatErrorBoundary>
          <GroupChat
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            bgImage={bgImage}
            bgImages={bgImages}
            token={token}
            currentUserName={currentUserName}
            currentUserId={currentUserId}
          />
        </GroupChatErrorBoundary>
      )}

      {/* Theme Changer Modal */}
      <ThemeChanger
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        onThemeChange={setBgImage}
      />
    </div>
  );
}
