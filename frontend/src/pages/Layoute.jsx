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
  Menu,
  X,
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
  const [theme] = useState("dark");
  const [bgImage, setBgImage] = useState(() => {
    const savedTheme = localStorage.getItem("selectedTheme");
    return savedTheme || "dark";
  });

  // Mobile States - ✅ FIX: Initialize sidebarOpen to true
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(); // ✅ START AS TRUE

  // ✅ APPLY THEME ON MOUNT
  useEffect(() => {
    const savedTheme = localStorage.getItem("selectedTheme") || "dark";
    applyTheme(savedTheme);
  }, []);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSettings] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
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

  // ✅ RESET SIDEBAR WHEN TAB CHANGES
  useEffect(() => {
    // On desktop (md+), always show sidebar
    // On mobile (< md), keep current state but don't force close
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Desktop - always show sidebar
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount

    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]); // ✅ ADD activeTab as dependency

  const handleLogout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    navigate("/login");
  };

  const handleFriendRemoved = useCallback((removedUserId) => {
    console.log(`✅ [LAYOUT] Friend removed from system:`, removedUserId);
    
    setAllUsers(prevUsers => {
      const filtered = prevUsers.filter(user => user.userId !== removedUserId);
      console.log(`✅ [LAYOUT] Remaining users:`, filtered.length);
      return filtered;
    });
  }, [setAllUsers]);

  // Navigation Items
  const navItems = [
    { id: "chats", icon: MessageCircle, label: "Chats" },
    { id: "groups", icon: Users, label: "Groups" },
  ];

  return (
    <div className={`flex h-screen flex-col md:flex-row ${bgImage === "dark" ? "bg-gray-900" : "bg-slate-50"} overflow-hidden`}>
      
      {/* MOBILE HEADER */}
      <div className={`md:hidden w-full h-16 flex items-center justify-between px-4 border-b border-[rgb(var(--border-secondary))] bg-[rgb(var(--bg-secondary))] z-40 sticky top-0`}>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className={`p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] transition-all`}
        >
          {mobileNavOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>

        <div
          className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg cursor-pointer hover:scale-110 transition-transform"
          title={currentUserName}
        >
          {currentUserName.charAt(0).toUpperCase()}
        </div>

        <button
          onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}
          className={`p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] transition-all`}
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileNavOpen && (
        <div className={`md:hidden fixed inset-0 top-16 left-0 w-64 bg-[rgb(var(--bg-secondary))] border-r border-[rgb(var(--border-secondary))] z-30 animate-in slide-in-from-left p-4 space-y-4`}>
          <nav className="flex flex-col gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                    setSidebarOpen(true); // ✅ SHOW SIDEBAR WHEN TAB CHANGES
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? "text-green-400 bg-[rgb(var(--bg-hover))] glow-green"
                      : "text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))]"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => {
                setShowFriendModal(true);
                setMobileNavOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))] transition-all"
              title="Add Contact"
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Add Contact</span>
            </button>
          </nav>

          <div className="pt-4 border-t border-[rgb(var(--border-secondary))] space-y-3">
            <button
              onClick={() => {
                setShowThemeModal(true);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                bgImage === "dark"
                  ? "text-green-400 bg-[rgb(var(--bg-hover))] glow-green"
                  : "text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))]"
              }`}
              title={`Theme: ${bgImage === "dark" ? "Dark" : "Light"}`}
            >
              {bgImage === "dark" ? (
                <Moon className="w-5 h-5 flex-shrink-0" />
              ) : (
                <Sun className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">
                {bgImage === "dark" ? "Dark Mode" : "Light Mode"}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE SETTINGS DRAWER */}
      {mobileSettingsOpen && (
        <div className={`md:hidden fixed inset-0 top-16 right-0 w-64 bg-[rgb(var(--bg-secondary))] border-l border-[rgb(var(--border-secondary))] z-30 animate-in slide-in-from-right p-4 space-y-4`}>
          <h3 className="text-sm font-bold text-[rgb(var(--text-primary))] uppercase tracking-wider">Settings</h3>

          <div className="space-y-4 pt-2">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg">
              <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                Sound
              </span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-10 h-6 rounded-full transition-all ${soundEnabled ? "bg-green-500" : "bg-gray-600"} relative flex-shrink-0`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${soundEnabled ? "right-1" : "left-1"}`}
                />
              </button>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg">
              <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
                Notifications
              </span>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-10 h-6 rounded-full transition-all ${notificationsEnabled ? "bg-green-500" : "bg-gray-600"} relative flex-shrink-0`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? "right-1" : "left-1"}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR - Navigation Icons */}
      <div className={`hidden md:flex md:w-16 lg:w-20 glass-effect bg-[rgb(var(--bg-secondary))] md:bg-transparent border-r border-[rgb(var(--border-secondary))] flex-col items-center py-4 gap-6 transition-colors duration-300`}>
        <div
          className="w-10 lg:w-12 h-10 lg:h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm lg:text-lg shadow-lg glow-green cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
          title={currentUserName}
        >
          {currentUserName.charAt(0).toUpperCase()}
        </div>

        <nav className="flex flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(true); // ✅ ALWAYS SHOW SIDEBAR ON DESKTOP
                }}
                className={`p-3 lg:p-4 rounded-xl transition-all flex items-center justify-center ${
                  activeTab === item.id
                    ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
                    : "text-[rgb(var(--text-muted))] hover:text-green-400"
                }`}
                title={item.label}
              >
                <Icon className="w-5 lg:w-6 h-5 lg:h-6" />
              </button>
            );
          })}

          <button
            onClick={() => setShowFriendModal(true)}
            className="p-3 lg:p-4 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex items-center justify-center"
            title="Add Contact"
          >
            <Plus className="w-5 lg:w-6 h-5 lg:h-6" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button
            onClick={() => setShowThemeModal(true)}
            className={`p-3 lg:p-4 rounded-xl transition-all flex items-center justify-center ${
              bgImage === "dark"
                ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
                : "text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))]"
            }`}
            title={`Theme: ${bgImage === "dark" ? "Dark" : "Light"}`}
          >
            {bgImage === "dark" ? (
              <Moon className="w-5 lg:w-6 h-5 lg:h-6" />
            ) : (
              <Sun className="w-5 lg:w-6 h-5 lg:h-6" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 lg:p-4 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex items-center justify-center"
            title="Settings"
          >
            <Settings className="w-5 lg:w-6 h-5 lg:h-6" />
          </button>

          <button
            onClick={handleLogout}
            className="p-3 lg:p-4 hover:bg-red-500/20 rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-red-400 flex items-center justify-center"
            title="Logout"
          >
            <LogOut className="w-5 lg:w-6 h-5 lg:h-6" />
          </button>
        </div>
      </div>

      {/* DESKTOP SETTINGS PANEL */}
      {showSettings && !showThemeSettings && (
        <div className={`hidden md:flex flex-col p-4 lg:p-6 bg-[rgb(var(--bg-secondary))]/50 border-r border-[rgb(var(--border-secondary))] space-y-3 lg:space-y-4 animate-in slide-in-from-left w-48 lg:w-56 transition-colors duration-300`}>
          <h3 className="text-xs lg:text-sm font-bold text-[rgb(var(--text-muted))] uppercase tracking-wider">Settings</h3>

          <div className="space-y-1 space-y-3 lg:space-y-4 pt-2">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-2 lg:p-3 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors">
              <span className="text-xs lg:text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Sound</span>
              </span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${soundEnabled ? "bg-green-500" : "bg-gray-600"} relative`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${soundEnabled ? "right-1" : "left-1"}`}
                />
              </button>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between p-2 lg:p-3 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors">
              <span className="text-xs lg:text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Notifications</span>
              </span>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${notificationsEnabled ? "bg-green-500" : "bg-gray-600"} relative`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? "right-1" : "left-1"}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0 overflow-hidden">
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
      </div>

      {/* Modals */}
      <FriendRequestModal
        isOpen={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        token={token}
        onFriendRemoved={handleFriendRemoved}
      />

      <ThemeChanger
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        onThemeChange={setBgImage}
      />

      {/* Mobile Nav Overlay */}
      {(mobileNavOpen || mobileSettingsOpen) && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-20 top-16"
          onClick={() => {
            setMobileNavOpen(false);
            setMobileSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
