import React, {
  useEffect,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  disconnectSocket,
} from "@socket/socketClient.js";
import { applyTheme } from "@utils/themeUtils.js";
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
import FriendRequestModal from "@pages/FriendRequestModal";

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
    return savedTheme || "dark";
  });

  // ✅ APPLY THEME ON MOUNT
  useEffect(() => {
    const savedTheme = localStorage.getItem("selectedTheme") || "dark";
    applyTheme(savedTheme);
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSettings, ] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [showFriendModal, setShowFriendModal] = useState(false);

  // Background images with text colors and fonts - Dark and Light only
  const bgImages = {
    dark: {
      bg: "linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)",
      textColor: "#e5e7eb",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      fontWeight: "500"
    },
    light: {
      bg: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
      textColor: "#1f2937",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      fontWeight: "500"
    },
  };

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("selectedTheme", bgImage);
    applyTheme(bgImage);
  }, [bgImage]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    navigate("/login");
  };

  const handleFriendRemoved = useCallback((removedUserId) => {
    console.log(`✅ [LAYOUT] Friend removed from system:`, removedUserId);
    
    // Update allUsers in Chat component
    setAllUsers(prevUsers => {
      const filtered = prevUsers.filter(user => user.userId !== removedUserId);
      console.log(`✅ [LAYOUT] Remaining users:`, filtered.length);
      return filtered;
    });
  }, [setAllUsers]);

  return (
    <div className={`flex h-screen ${bgImage === "dark" ? "bg-gray-900" : "bg-slate-50"}`}>
      {/* LEFT SIDEBAR - Navigation Icons */}
      <div className={`hidden sm:flex sm:w-16 md:w-20 sm:glass-effect bg-[rgb(var(--bg-secondary))] sm:bg-transparent border-r border-[rgb(var(--border-secondary))] flex-col items-center py-3 sm:py-4 gap-4 sm:gap-6 transition-colors duration-300`}>
        <div
          className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg glow-green cursor-pointer hover:scale-110 transition-transform"
          title={currentUserName}
        >
          {currentUserName.charAt(0).toUpperCase()}
        </div>

        <nav className="flex flex-col gap-4">
          <button
            onClick={() => setActiveTab("chats")}
            className={`p-3 rounded-xl transition-all ${activeTab === "chats" ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]" : `text-[rgb(var(--text-muted))] hover:text-green-400`}`}
            title="Chats"
          >
            <MessageCircle className="w-6 h-6" />
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`p-3 rounded-xl transition-all ${activeTab === "groups" ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]" : `text-[rgb(var(--text-muted))] hover:text-green-400`}`}
            title="Groups"
          >
            <Users className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowFriendModal(true)}
            className={`p-3 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400`}
            title="Add Contact"
          >
            <Plus className="w-6 h-6" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button
            onClick={() => setShowThemeModal(true)}
            className={`p-3 rounded-xl transition-all ${bgImage === "dark" ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]" : "text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))]"}`}
            title={`Theme: ${bgImage === "dark" ? "Dark" : "Light"}`}
          >
            {bgImage === "dark" ? (
              <Moon className="w-6 h-6" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400`}
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>

          <button
            onClick={handleLogout}
            className="p-3 hover:bg-red-500/20 rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-red-400"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && !showThemeSettings && (
        <div className={`p-4 bg-[rgb(var(--bg-secondary))]/50 border-r border-[rgb(var(--border-secondary))] space-y-2 animate-in slide-in-from-left w-56 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm text-[rgb(var(--text-muted))] flex items-center gap-2`}>
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
            <span className={`text-sm text-[rgb(var(--text-muted))] flex items-center gap-2`}>
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

      {/* Friend Request Modal */}
      <FriendRequestModal
        isOpen={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        token={token}
        onFriendRemoved={handleFriendRemoved}
      />

      {/* Theme Changer Modal */}
      <ThemeChanger
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        onThemeChange={setBgImage}
      />
    </div>
  );
}
