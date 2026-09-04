import React, {
  useEffect,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  connectSocket,
  disconnectSocket,
} from "@socket/socketClient.js";
import authService from "@services/auth.service";
import cryptoService from "@services/crypto.service";
import { applyTheme } from "@utils/themeUtils.js";
import ThemeChanger from "@components/ThemeChanger";
import ProfileSettingsModal from "@components/ProfileSettingsModal";
import UnlockEncryptionModal from "@components/UnlockEncryptionModal";
import CallModal from "@components/CallModal";
import Avatar from "@components/Avatar";
import { useCall } from "@hooks/useCall.js";
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
  ChevronRight,
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

  // Mobile States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileBottomSheetOpen, setMobileBottomSheetOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); //  TRACK IF CHAT IS OPEN

  //  APPLY THEME ON MOUNT
  useEffect(() => {
    const savedTheme = localStorage.getItem("selectedTheme") || "dark";
    applyTheme(savedTheme);
  }, []);
  
  //  PHASE 5: CENTRALIZED SOCKET CONNECTION
  useEffect(() => {
    if (token) {
      connectSocket(token);
      
      return () => {
        // Socket should stay alive throughout the app session
        // disconnectSocket() is usually called on manual logout
      };
    }
  }, [token]);

  // The keypair only ever lives in sessionStorage (tab-scoped) — a valid
  // login token in localStorage doesn't mean the keypair survived (new tab,
  // browser restart, cleared session storage). Try to restore it locally
  // first; if that fails, the getCurrentUser effect below decides whether
  // to prompt for the password (see needsUnlock).
  useEffect(() => {
    if (!token || !currentUserId || cryptoService.myKeypair) {
      return;
    }

    cryptoService.restoreMyKeypairFromSession(currentUserId);
  }, [token, currentUserId]);

  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [unlockInfo, setUnlockInfo] = useState(null);

  const call = useCall(currentUserId);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(() => {
    return localStorage.getItem("notificationsEnabled") !== "false";
  });

  // Desktop notifications need explicit browser permission — request it the
  // moment the user opts in via the toggle (a click is a user gesture,
  // required for requestPermission to work in most browsers). If they deny
  // it, flip the toggle back off so the UI doesn't claim it's on when
  // nothing will actually show.
  const setNotificationsEnabled = useCallback((enabled) => {
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        const granted = permission === "granted";
        localStorage.setItem("notificationsEnabled", String(granted));
        setNotificationsEnabledState(granted);
      });
      return;
    }
    localStorage.setItem("notificationsEnabled", String(enabled));
    setNotificationsEnabledState(enabled);
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [avatar, setAvatar] = useState(null);

  // Avatar isn't in the JWT (bloats the token, and would need re-issuing on
  // every change) — fetch it once on mount instead. Also doubles as the
  // check for whether the E2EE keypair actually made it into memory: if
  // not (see the restore-from-session effect above), prompt to unlock
  // rather than let every message silently fail to decrypt.
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    authService.getCurrentUser()
      .then((response) => {
        if (!isMounted) return;
        if (response?.data?.avatar) {
          setAvatar(response.data.avatar);
        }
        if (!cryptoService.myKeypair && response?.data?.email && response?.data?.publicKey) {
          setUnlockInfo({ email: response.data.email, publicKey: response.data.publicKey });
          setNeedsUnlock(true);
        }
      })
      .catch(() => {
        // ProtectedRoute already handles auth failures; nothing more to do here.
      });

    return () => { isMounted = false; };
  }, [token]);
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

  //  RESET SIDEBAR WHEN TAB CHANGES
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
  }, [activeTab]); //  ADD activeTab as dependency

  const handleLogout = async () => {
    // ✅ E2EE: Clear encryption keys on logout
    cryptoService.clearAllKeys();

    await authService.logout();
    disconnectSocket();
    navigate("/login");
  };

  const handleFriendRemoved = useCallback((removedUserId) => {
    
    setAllUsers(prevUsers => {
      const filtered = prevUsers.filter(user => user.userId !== removedUserId);
      return filtered;
    });
  }, [setAllUsers]);

  // Navigation Items
  const navItems = [
    { id: "chats", icon: MessageCircle, label: "Chats" },
    { id: "groups", icon: Users, label: "Groups" },
  ];

  return (
    <div className={`flex h-dvh flex-col md:flex-row ${bgImage === "dark" ? "bg-gray-900" : "bg-slate-50"} overflow-hidden`}>
      
      {/* DESKTOP SIDEBAR - Navigation Icons */}
      <div className={`hidden md:flex md:w-16 lg:w-20 glass-effect bg-[rgb(var(--bg-secondary))] md:bg-transparent border-r border-[rgb(var(--border-secondary))] flex-col items-center py-4 gap-6 transition-colors duration-300`}>
        <button
          onClick={() => setShowSettings(true)}
          title={`${currentUserName} — edit profile picture`}
          aria-label="Edit profile picture"
          className="cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
        >
          <Avatar src={avatar} name={currentUserName} />
        </button>

        <nav className="flex flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(true); //  ALWAYS SHOW SIDEBAR ON DESKTOP
                }}
                className={`p-3 lg:p-4 rounded-xl transition-all flex items-center justify-center ${
                  activeTab === item.id
                    ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
                    : "text-[rgb(var(--text-muted))] hover:text-green-400"
                }`}
                title={item.label}
                aria-label={item.label}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                <Icon className="w-5 lg:w-6 h-5 lg:h-6" />
              </button>
            );
          })}

          <button
            onClick={() => setShowFriendModal(true)}
            className="p-3 lg:p-4 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex items-center justify-center"
            title="Add Contact"
            aria-label="Add contact"
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
            aria-label={`Change theme (currently ${bgImage === "dark" ? "Dark" : "Light"})`}
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
            aria-label="Settings"
          >
            <Settings className="w-5 lg:w-6 h-5 lg:h-6" />
          </button>

          <button
            onClick={handleLogout}
            className="p-3 lg:p-4 hover:bg-red-500/20 rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-red-400 flex items-center justify-center"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-5 lg:w-6 h-5 lg:h-6" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA - Mobile Safe */}
      <div className="flex-1 flex flex-col overflow-hidden w-full min-h-0">
        {/* Render Chat or GroupChat based on active tab */}
        {activeTab === "chats" ? (
          <Chat
            onlineUsers={[]}
            allUsers={allUsers}
            setAllUsers={setAllUsers}
            currentUserName={currentUserName}
            currentUserId={currentUserId}
            avatar={avatar}
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
            onChatOpen={setIsChatOpen}
            isChatOpen={isChatOpen}
            onStartCall={call.startCall}
            callStatus={call.status}
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
              notificationsEnabled={notificationsEnabled}
              onChatOpen={setIsChatOpen}
              isChatOpen={isChatOpen}
            />
          </GroupChatErrorBoundary>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION - Safe Area & Mobile Optimized */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[rgb(var(--bg-secondary))] border-t border-[rgb(var(--border-secondary))] flex items-center justify-between px-2 z-50 gap-1 transition-all duration-300 safe-pbottom ${
        isChatOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        {/* Chats Tab */}
        <button
          onClick={() => setActiveTab("chats")}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === "chats"
              ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
              : "text-[rgb(var(--text-muted))] hover:text-green-400"
          }`}
          title="Chats"
        >
          <MessageCircle className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-medium mt-1">Chats</span>
        </button>

        {/* Groups Tab */}
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === "groups"
              ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
              : "text-[rgb(var(--text-muted))] hover:text-green-400"
          }`}
          title="Groups"
        >
          <Users className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-medium mt-1">Groups</span>
        </button>

        {/* Add Friend Tab */}
        <button
          onClick={() => setShowFriendModal(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))] transition-all"
          title="Add Contact"
        >
          <Plus className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-medium mt-1">Add</span>
        </button>

        {/* Settings/Theme Tab */}
        <button
          onClick={() => setMobileBottomSheetOpen(!mobileBottomSheetOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            mobileBottomSheetOpen
              ? "text-green-400 glow-green bg-[rgb(var(--bg-hover))]"
              : "text-[rgb(var(--text-muted))] hover:text-green-400"
          }`}
          title="More Options"
          aria-expanded={mobileBottomSheetOpen}
        >
          <Settings className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-medium mt-1">More</span>
        </button>
      </div>

      {/* MOBILE BOTTOM SHEET - Settings/More Options */}
      {mobileBottomSheetOpen && (
        <>
          {/* Overlay */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 bottom-16"
            onClick={() => setMobileBottomSheetOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[rgb(var(--bg-secondary))] border-t border-[rgb(var(--border-secondary))] rounded-t-2xl z-40 animate-in slide-in-from-bottom max-h-[50vh] overflow-y-auto">
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-bold text-[rgb(var(--text-primary))] uppercase tracking-wider mb-4">More Options</h3>

              {/* Profile Picture */}
              <button
                onClick={() => {
                  setShowSettings(true);
                  setMobileBottomSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg hover:bg-[rgb(var(--bg-hover))]/80 transition-all"
              >
                <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-3">
                  <Avatar src={avatar} name={currentUserName} size="sm" />
                  Profile Picture
                </span>
                <ChevronRight className="w-4 h-4 text-[rgb(var(--text-muted))]" />
              </button>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg">
                <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 flex-shrink-0" />
                  )}
                  Sound
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
              <div className="flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg">
                <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                  {notificationsEnabled ? (
                    <Bell className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <BellOff className="w-4 h-4 flex-shrink-0" />
                  )}
                  Notifications
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

              {/* Theme Toggle */}
              <button
                onClick={() => {
                  setBgImage(bgImage === "dark" ? "light" : "dark");
                  setMobileBottomSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 bg-[rgb(var(--bg-hover))] rounded-lg hover:bg-[rgb(var(--bg-hover))]/80 transition-all"
              >
                <span className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
                  {bgImage === "dark" ? (
                    <Moon className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Sun className="w-4 h-4 flex-shrink-0" />
                  )}
                  {bgImage === "dark" ? "Dark Mode" : "Light Mode"}
                </span>
                <ChevronRight className="w-4 h-4 text-[rgb(var(--text-muted))]" />
              </button>

              {/* Logout Button */}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileBottomSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all text-red-400"
              >
                <span className="text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Logout
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

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

      <ProfileSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentUserName={currentUserName}
        avatar={avatar}
        onAvatarChange={setAvatar}
      />

      <CallModal call={call} />

      {needsUnlock && unlockInfo && (
        <UnlockEncryptionModal
          userId={currentUserId}
          email={unlockInfo.email}
          expectedPublicKey={unlockInfo.publicKey}
          onUnlocked={() => {
            // Messages already rendered as "decryption failed" won't
            // retry on their own now that the keypair exists — a reload
            // is the simplest way to get everything to refetch and
            // decrypt correctly from a clean slate.
            window.location.reload();
          }}
          onLogout={() => {
            disconnectSocket();
            navigate("/login");
          }}
        />
      )}
    </div>
  );
}
