import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import messageService from "@services/message.service.js";
import friendAPI from '@api/friend.api.js';
import { SOCKET_EVENTS } from "@constants/socketEvents.js";
import { applyTheme, saveTheme } from "@utils/themeUtils.js";
import {
  connectSocket,
  getSocket,
  isSocketConnected,
} from "@socket/socketClient.js";
import {
  MessageCircle,
  Search,
  Pin,
  Circle,
  MoreVertical,
  Send,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Menu,
  ChevronLeft,
  X,
  Loader,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import ThemeChanger from "@/components/ThemeChanger";
import { useDebounce } from '@hooks/useDebounce';

export default function Chat({
  currentUserName,
  currentUserId,
  token,
  allUsers,
  setAllUsers,
  sidebarOpen,
  setSidebarOpen,
  onChatOpen,
  isChatOpen,
}) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Chat States
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [pinnedChats, setPinnedChats] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [selectedUserId, setSelectedUserIdState] = useState(null);
  
  // Wrapper to keep ref in sync
  const setSelectedUserId = useCallback((id) => {
    selectedUserIdRef.current = id;
    setSelectedUserIdState(id);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showThemeChanger, setShowThemeChanger] = useState(false);
  
  // ✅ ADD THIS: Debounce the search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // ✅ NEW: Socket connection status
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [socketError, setSocketError] = useState('');

  const typingTimeoutRef = useRef(null);
  const lastTypingTimeRef = useRef(0);
  const errorTimeoutRef = useRef(null);
  const selectedUserIdRef = useRef(null); // ✅ TRACK CURRENT SELECTION WITHOUT RE-RENDERS

  // ✅ AUTO-CLEAR ERRORS AFTER 5 SECONDS
  useEffect(() => {
    if (error) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setError("");
      }, 5000);
    }
  }, [error]);

  // ✅ AUTO-CLEAR SOCKET ERRORS AFTER 5 SECONDS
  useEffect(() => {
    if (socketError) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setSocketError("");
      }, 5000);
    }
  }, [socketError]);

  // ✅ APPLY SAVED THEME ON MOUNT
  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
    applyTheme(savedTheme);
  }, []);

  // ✅ COMPREHENSIVE PROTECTION: NO BACK, NO CLOSE, NO SWIPE-BACK
  useEffect(() => {
    // 1️⃣ PREVENT BACK BUTTON - Replace history so browser back doesn't work
    window.history.replaceState(null, "", window.location.href);

    // 2️⃣ PREVENT BACK BUTTON - Trap popstate event
    const handlePopState = (e) => {
      e.preventDefault();
      // Push forward to keep user on chat page
      window.history.forward();
    };
    window.addEventListener('popstate', handlePopState);

    // 3️⃣ PREVENT TAB CLOSE - Warn user before leaving/closing
    const handleBeforeUnload = (e) => {
      const message = "You have an active chat. Are you sure you want to close this tab?";
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 4️⃣ PREVENT SWIPE-BACK GESTURE ON MOBILE
    const handleTouchMove = (e) => {
      // If user swipes from left edge to go back, prevent it
      const touch = e.touches[0];
      if (touch && touch.clientX < 10) {
        e.preventDefault();
      }
    };
    // Use 'passive: false' to allow preventDefault
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // 5️⃣ DISABLE BROWSER CONTROLS - Meta+W, Alt+Left, etc.
    const handleKeyDown = (e) => {
      // Prevent Ctrl+W / Cmd+W (close tab)
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        return false;
      }
      // Prevent Alt+Left (back button)
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        return false;
      }
      // Prevent Alt+Right (forward button) 
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 6️⃣ PREVENT OPENING CONTEXT MENU / RIGHT CLICK (optional, can remove if needed)
    const handleContextMenu = () => {
      // You can disable right-click, but it's better to allow it for accessibility
      // Uncomment if you want to disable it:
      // e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // ✅ FETCH ONLY FRIENDS (not all users)
  const fetchFriends = useCallback(async () => {
    try {
      console.log("🔄 Fetching friends only...");
      setLoadingFriends(true);

      const response = await friendAPI.getFriends();

      console.log("✅ Friends fetched:", response.data.data);

      if (response.data.success) {
        const rawData = response.data?.data;
        const friends = Array.isArray(rawData) ? rawData : (rawData?.data || []);
        
        setAllUsers(
          friends.map((u) => ({
            userId: u._id || u.userId,
            name: u.name,
            email: u.email,
            online: false,
            lastSeen: u.lastSeen,
            createdAt: u.createdAt,
          }))
        );
        
        console.log(`✅ [CHAT] Loaded ${friends.length} friends`);
        setError("");
      }
    } catch (err) {
      console.error("❌ Failed to fetch friends:", err.message);
      setError("⚠️ Failed to load friends. Please refresh.");
    } finally {
      setLoadingFriends(false);
    }
  }, [setAllUsers]);

  // ✅ FETCH FRIENDS ON MOUNT
  useEffect(() => {
    if (!token) return;
    fetchFriends();
  }, [token, fetchFriends]);

  // ✅ HANDLE FRIEND REMOVAL - REFETCH FRIENDS
  const handleFriendRemoved = useCallback((removedUserId) => {
    console.log(`✅ [CHAT] Friend removed:`, removedUserId);
    
    setAllUsers(prevUsers => {
      const filtered = prevUsers.filter(user => user.userId !== removedUserId);
      console.log(`✅ [CHAT] Removed from UI. Remaining:`, filtered.length);
      return filtered;
    });

    if (selectedUserId === removedUserId) {
      console.log(`✅ [CHAT] Closing chat with removed friend`);
      setSelectedUserId(null);
      setMessages([]);
    }

    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[removedUserId];
      return updated;
    });

    setPinnedChats(prev => prev.filter(id => id !== removedUserId));

    setTimeout(() => {
      console.log(`📡 [CHAT] Refetching friends list from backend...`);
      fetchFriends();
    }, 300);
  }, [selectedUserId, fetchFriends, setAllUsers]);

  useEffect(() => {
    // ✅ PHASE 6: CLEAN SOCKET INITIALIZATION
    let socketInitInterval;
    let cleanup;

    // ✅ ONLINE USERS HANDLER
    const handleOnlineUsers = (users) => {
      console.log("📡 [ONLINE_USERS] Received:", users?.length, "users");
      if (users && users.length > 0) {
        setAllUsers((prevUsers) => {
          return prevUsers.map((friendUser) => {
            const onlineUser = users.find(
              (ou) => String(ou.userId) === String(friendUser.userId)
            );
            return { ...friendUser, online: !!onlineUser };
          });
        });
      }
    };

    // ✅ INCOMING MESSAGE HANDLER
    const handlePrivateMessage = (data) => {
      const isInCurrentChat = String(data.fromUserId) === String(selectedUserIdRef.current);

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(data._id))) return prev;

        const newMessage = {
          _id: data._id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || "Unknown",
          toUserId: data.toUserId || currentUserId,
          message: data.message,
          time: data.time || new Date().toISOString(),
          read: isInCurrentChat,
          delivered: true,
        };
        return [...prev, newMessage];
      });

      if (isInCurrentChat) {
        const socket = getSocket();
        if (socket) {
          socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
            messageId: data._id,
            senderId: data.fromUserId,
            receiverId: currentUserId,
          });
        }
      } else {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.fromUserId]: (prev[data.fromUserId] || 0) + 1,
        }));
      }
    };

    // ✅ MESSAGE SENT CONFIRMATION
    const handleMessageSent = (data) => {
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(data._id))) return prev;
        return [
          ...prev,
          {
            _id: data._id,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            fromUserName: data.fromUserName,
            message: data.message,
            time: data.time,
            delivered: data.delivered,
            read: false,
          }
        ];
      });
    };

    // ✅ MESSAGE READ HANDLER
    const handleMessageRead = (data) => {
      console.log("🔵 [MESSAGE_READ] Received:", data.messageId);
      setMessages((prev) => {
        const index = prev.findIndex((m) => String(m._id) === String(data.messageId));
        if (index === -1) return prev;
        if (prev[index].read) return prev;

        const updated = [...prev];
        updated[index] = { ...updated[index], read: true };
        return updated;
      });
    };

    // ✅ USER OFFLINE HANDLER
    const handleUserOffline = ({ userId: offlineUserId }) => {
      setAllUsers((prev) => prev.map(u => 
        String(u.userId) === String(offlineUserId) ? { ...u, online: false } : u
      ));
    };

    // ✅ TYPING HANDLER
    const handleTyping = ({ fromUserId, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [fromUserId]: isTyping }));
    };

    // ✅ MESSAGE DELETED HANDLER
    const handleMessageDeleted = (data) => {
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(data.messageId)));
    };

    const registerListeners = (socket) => {
      if (socket.connected) setSocketStatus('connected');
      
      socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
      socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
      socket.on(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
      socket.on(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
      socket.on(SOCKET_EVENTS.TYPING, handleTyping);
      socket.on(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
      socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);

      return () => {
        socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
        socket.off(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
        socket.off(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
        socket.off(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
        socket.off(SOCKET_EVENTS.TYPING, handleTyping);
        socket.off(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
        socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      };
    };

    const init = () => {
      const s = getSocket();
      if (s) {
        cleanup = registerListeners(s);
        return true;
      }
      return false;
    };

    if (!init()) {
      socketInitInterval = setInterval(() => {
        if (init()) clearInterval(socketInitInterval);
      }, 100);
    }

    return () => {
      if (socketInitInterval) clearInterval(socketInitInterval);
      if (cleanup) cleanup();
    };
  }, [token, navigate, currentUserId, currentUserName, setAllUsers]);

  // ✅ FETCH CHAT HISTORY
  useEffect(() => {
    if (!selectedUserId) return;

    const fetchChatHistory = async () => {
      setLoading(true);
      try {
        const data = await messageService.fetchChatHistory(selectedUserId);
        const messagesWithIds = data.messages.map((msg) => ({
          _id: msg._id,
          fromUserId: msg.fromUserId,
          toUserId: msg.toUserId,
          fromUserName: msg.senderName || "Unknown",
          message: msg.message,
          time: msg.createdAt,
          read: msg.read,
        }));
        setMessages(messagesWithIds);

        const unreadMessages = messagesWithIds.filter(
          (msg) => msg.fromUserId === selectedUserId && !msg.read
        );

        if (unreadMessages.length > 0) {
          const socket = getSocket();
          if (socket && socket.connected) {
            unreadMessages.forEach((msg) => {
              console.log(`📤 [Frontend] Emitting READ_RECEIPT for ${msg._id}`);
              socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
                messageId: msg._id,
                senderId: msg.fromUserId,
                receiverId: currentUserId,
              });
            });
          }

          try {
            await messageService.markMessagesAsRead(selectedUserId);
          } catch (apiErr) {
            console.error("❌ Failed to mark as read in DB:", apiErr);
            setError("⚠️ Failed to mark messages as read");
          }
        }
        setError("");
      } catch (err) {
        console.error("❌ Failed to fetch chat history:", err);
        setError("⚠️ Failed to load chat history");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
    setUnreadCounts((prev) => ({
      ...prev,
      [selectedUserId]: 0,
    }));
    messageInputRef.current?.focus();
  }, [selectedUserId, currentUserId]);

  // ✅ REMOVED inefficient 2-second history polling

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages]);

  // ✅ HIDE MOBILE BOTTOM NAV WHEN CHAT IS OPEN
  useEffect(() => {
    if (onChatOpen) {
      onChatOpen(!!selectedUserId);
    }
  }, [selectedUserId, onChatOpen]);

  // Filtered users (only friends now)
  const filteredUsers = useMemo(() => {
    const usersToFilter = allUsers;

    return usersToFilter
      .filter((user) => user.userId !== currentUserId)
      .filter((user) =>
        user.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const aIsPinned = pinnedChats.includes(a.userId);
        const bIsPinned = pinnedChats.includes(b.userId);
        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;

        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;

        const aUnread = unreadCounts[a.userId] || 0;
        const bUnread = unreadCounts[b.userId] || 0;
        return bUnread - aUnread;
      });
    // ✅ CHANGE DEPENDENCY: Use debouncedSearchQuery
  }, [allUsers, currentUserId, debouncedSearchQuery, pinnedChats, unreadCounts]);

  // Current chat messages
  const currentChatMessages = useMemo(() => {
    return messages.filter((m) => {
      if (!selectedUserId) return false;
      return (
        (m.fromUserId === currentUserId && m.toUserId === selectedUserId) ||
        (m.fromUserId === selectedUserId && m.toUserId === currentUserId)
      );
    });
  }, [messages, selectedUserId, currentUserId]);

  // Send message
  const handleSendMessage = useCallback(() => {
    const socket = getSocket();
    if (!socket || !isSocketConnected()) {
      setSocketError("🔴 Not connected. Please refresh.");
      return;
    }

    if (!selectedUserId || !messageInput.trim()) return;

    console.log("📤 [SEND] Sending message:", messageInput.trim());

    socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
      toUserId: selectedUserId,
      message: messageInput.trim(),
    });

    setMessageInput("");
  }, [selectedUserId, messageInput]);

  // Handle typing
  const handleChatTyping = useCallback(
    (isTyping) => {
      const socket = getSocket();
      if (!socket || !selectedUserId) return;

      const now = Date.now();
      const timeSinceLastTyping = now - lastTypingTimeRef.current;

      if (timeSinceLastTyping < 300 && isTyping) return;

      lastTypingTimeRef.current = now;

      if (isTyping) {
        socket.emit(SOCKET_EVENTS.TYPING, {
          toUserId: selectedUserId,
          isTyping: true,
        });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit(SOCKET_EVENTS.TYPING, {
            toUserId: selectedUserId,
            isTyping: false,
          });
        }, 2000);
      }
    },
    [selectedUserId]
  );

  const togglePinChat = useCallback((userId) => {
    setPinnedChats((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const getDisplayName = useCallback(
    (userId) => {
      const user = allUsers.find((u) => u.userId === userId);
      return user?.name || userId;
    },
    [allUsers]
  );

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ✅ DELETE MESSAGE HANDLER
  const handleDeleteMessage = useCallback(
    async (messageId) => {
      const confirmed = window.confirm("Are you sure you want to delete this message?");
      if (!confirmed) return;

      try {
        console.log("🗑️ [DELETE] Deleting message:", messageId);

        const socket = getSocket();
        if (!socket || !isSocketConnected()) {
          setSocketError("🔴 Not connected. Please refresh.");
          return;
        }

        setMessages((prev) => {
          const updated = prev.filter((m) => m._id !== messageId);
          console.log(`✅ [DELETE] Message removed from UI:`, messageId);
          return updated;
        });

        socket.emit(SOCKET_EVENTS.MESSAGE_DELETED, {
          messageId: messageId,
          toUserId: selectedUserIdRef.current,
        });

        console.log("📤 [DELETE] Delete notification sent to backend");
      } catch (err) {
        console.error("❌ [DELETE] Error:", err);
        setError("⚠️ Failed to delete message");
      
        const data = await messageService.fetchChatHistory(selectedUserId);
        setMessages(
          data.messages.map((msg) => ({
            _id: msg._id,
            fromUserId: msg.fromUserId,
            toUserId: msg.toUserId,
            fromUserName: msg.senderName || "Unknown",
            message: msg.message,
            time: msg.createdAt,
            read: msg.read,
          }))
        );
      }
    },
    [selectedUserId]
  );

  // ✅ EXPORT HANDLER FOR PARENT COMPONENT
  useEffect(() => {
    window.chatHandleFriendRemoved = handleFriendRemoved;
    return () => {
      delete window.chatHandleFriendRemoved;
    };
  }, [handleFriendRemoved]);

  return (
    <>
      {/* Theme Changer Modal */}
      <ThemeChanger
        isOpen={showThemeChanger}
        onClose={() => setShowThemeChanger(false)}
        onThemeChange={(themeName) => {
          console.log("🎨 [CHAT] Theme changed to:", themeName);
          applyTheme(themeName);
          saveTheme(themeName);
        }}
      />

      {/* ✅ SOCKET STATUS BAR */}
      {socketStatus !== 'connected' && (
        <div className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex items-center gap-2 ${
          socketStatus === 'error' 
            ? 'bg-red-500/20 border-b border-red-500/30 text-red-400' 
            : 'bg-yellow-500/20 border-b border-yellow-500/30 text-yellow-400'
        }`}>
          {socketStatus === 'connecting' ? (
            <>
              <div className="animate-spin">⏳</div>
              Connecting to server...
            </>
          ) : socketStatus === 'disconnected' ? (
            <>
              <WifiOff className="w-4 h-4 shrink-0" />
              Connection lost - trying to reconnect...
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Connection error - refresh if needed
            </>
          )}
        </div>
      )}

      {/* Main Container - Mobile Safe */}
      <div className={`w-full h-full flex flex-col md:flex-row gap-0 overflow-hidden ${isChatOpen ? 'pb-0' : 'pb-14 sm:pb-16'} md:pb-0 min-h-0`}>
        
        {/* SIDEBAR - Friends List - Mobile Safe */}
        <div
          className={`${
            sidebarOpen ? "w-full sm:w-80 md:w-96" : "w-0 hidden"
          } bg-[rgb(var(--bg-secondary))] sm:glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col transition-all duration-300 overflow-hidden absolute md:relative md:z-0 z-40 h-full min-h-0`}
        >
          {/* Sidebar Header */}
          <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-[rgb(var(--text-primary))] whitespace-nowrap">
              {loadingFriends ? 'Loading...' : 'Friends'}
            </h2>
        
          </div>

          {/* Search Bar - Theme Aware & Mobile Responsive */}
          <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))] border-b border-[rgb(var(--border-secondary))]/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[rgb(var(--text-muted))]/70" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-[rgb(var(--bg-tertiary))]/50 backdrop-blur-sm border border-[rgb(var(--border-secondary))]/60 rounded-xl text-xs sm:text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))]/70 focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/40 transition-all duration-200 hover:bg-[rgb(var(--bg-tertiary))]/60 hover:border-[rgb(var(--border-secondary))]/80"
              />
            </div>
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-3 sm:p-4 text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider flex items-center gap-2">
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span>Friends ({filteredUsers.length})</span>
            </div>

            {loadingFriends ? (
              <div className="flex items-center justify-center p-8 sm:p-12">
                <Loader className="w-8 h-8 text-green-400 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-[rgb(var(--text-muted))]">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30 flex-shrink-0" />
                <p className="text-xs sm:text-sm">
                  {allUsers.length === 0 
                    ? "No friends yet" 
                    : "No friends found"}
                </p>
              </div>
            ) : (
              <div className="space-y-1 p-2 sm:p-3">
                {filteredUsers.map((user) => {
                  const id = user.userId;
                  const name = user.name;
                  const isPinned = pinnedChats.includes(id);
                  const unreadCount = unreadCounts[id] || 0;
                  const isOnline = user.online;

                  return (
                    <div
                      key={id}
                      onClick={() => {
                        setSelectedUserId(id);
                        if (window.innerWidth < 640) {
                          setSidebarOpen(false);
                        }
                      }}
                      className={`group relative p-2 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all ${
                        selectedUserId === id
                          ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                          : "hover:bg-[rgb(var(--bg-hover))]/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg ${
                              isOnline
                                ? "bg-linear-to-br from-green-500 to-teal-600"
                                : "bg-linear-to-br from-gray-500 to-gray-600"
                            }`}
                          >
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div
                            className={`absolute bottom-0 right-0 w-2.5 sm:w-3 h-2.5 sm:h-3 border-2 border-[rgb(var(--bg-secondary))] rounded-full ${
                              isOnline ? "bg-green-400 pulse-glow" : "bg-gray-400"
                            }`}
                          ></div>
                        </div>

                        {/* User Info */}
                        <div className={`flex-1 min-w-0 ${unreadCount > 0 ? 'sm:flex-1' : 'flex-1'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <h5 className="font-semibold text-xs sm:text-sm text-[rgb(var(--text-primary))] truncate">
                              {name}
                            </h5>
                            {isPinned && (
                              <Pin className="w-3 h-3 text-green-400 shrink-0" />
                            )}
                          </div>
                          <p
                            className={`text-xs mt-0.5 ${
                              isOnline ? "text-green-500" : "text-[rgb(var(--text-muted))]"
                            }`}
                          >
                            {typingUsers[id] ? (
                              <span className="text-green-400">Typing...</span>
                            ) : isOnline ? (
                              <span className="flex items-center gap-1">
                                <Circle className="w-1 h-1 fill-green-500" />
                                Online
                              </span>
                            ) : (
                              "Offline"
                            )}
                          </p>
                        </div>

                        {/* Unread Badge - Always visible on mobile */}
                        {unreadCount > 0 && (
                          <div className="w-7 h-7 sm:w-6 sm:h-6 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-xs sm:text-xs font-bold text-black shadow-lg glow-green shrink-0 flex-shrink-0">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </div>
                        )}
                      </div>

                      {/* Pin Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinChat(id);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          isPinned
                            ? "text-green-400 bg-green-500/20"
                            : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-green-400"
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col bg-[rgb(var(--bg-primary))] overflow-hidden min-w-0 min-h-0">
          {selectedUserId ? (
            <>
              {/* Chat Header - Mobile Optimized */}
              <div className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => {
                      setSelectedUserId(null);
                      if (window.innerWidth < 768) {
                        setSidebarOpen(true); // ✅ OPEN SIDEBAR ON MOBILE
                      }
                    }}
                    className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0"
                  >
                    <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                  </button>

                  {/* User Avatar & Info - Mobile Safe */}
                  <div className="relative shrink-0">
                    <div className="w-8 xs:w-9 sm:w-10 md:w-11 h-8 xs:h-9 sm:h-10 md:h-11 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-lg glow-green text-xs sm:text-sm md:text-base">
                      {getDisplayName(selectedUserId).charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-1.5 sm:w-2.5 md:w-3 h-1.5 sm:h-2.5 md:h-3 border-2 border-[rgb(var(--bg-secondary))] rounded-full pulse-glow ${
                        allUsers.find(u => u.userId === selectedUserId)?.online 
                          ? 'bg-green-400' 
                          : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>

                  {/* User Name & Status */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base lg:text-lg text-[rgb(var(--text-primary))] truncate">
                      {getDisplayName(selectedUserId)}
                    </h3>
                    <p className="text-xs text-green-400 font-medium truncate">
                      {typingUsers[selectedUserId] 
                        ? "Typing..." 
                        : allUsers.find(u => u.userId === selectedUserId)?.online
                        ? "Active Now"
                        : "Offline"}
                    </p>
                  </div>
                </div>

                {/* More Options Button */}
                <button className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0">
                  <MoreVertical className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>

              {/* Messages Area - Mobile Optimized */}
              <div className="flex-1 overflow-y-auto px-2 xs:px-2.5 sm:px-3 md:px-4 lg:px-6 py-2 xs:py-2.5 sm:py-3 md:py-4 space-y-1 xs:space-y-2 sm:space-y-3 md:space-y-4 custom-scrollbar min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-3"></div>
                      <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))]">Loading messages...</p>
                    </div>
                  </div>
                ) : currentChatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--text-muted))]">
                    <div className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
                      <MessageCircle className="w-10 sm:w-12 h-10 sm:h-12 text-green-500/50" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold mb-2">Start Conversation</h3>
                    <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] text-center max-w-sm px-4">
                      Send a message to {getDisplayName(selectedUserId)}
                    </p>
                  </div>
                ) : (
                  currentChatMessages.map((m, index) => {
                    const isOwn = m.fromUserId === currentUserId;
                    const showAvatar =
                      index === 0 ||
                      currentChatMessages[index - 1].fromUserId !== m.fromUserId;

                    return (
                      <div
                        key={`${m._id}-${index}`}
                        className={`flex gap-2 sm:gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        {showAvatar ? (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shrink-0 ${
                              isOwn
                                ? "bg-linear-to-br from-blue-500 to-purple-600"
                                : "bg-linear-to-br from-green-500 to-teal-600 glow-green"
                            }`}
                          >
                            {(isOwn ? currentUserName : m.fromUserName)
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-8 shrink-0"></div>
                        )}

                        {/* Message Bubble - Responsive Width */}
                        <div
                          className={`flex flex-col ${isOwn ? "items-end" : "items-start"} w-full max-w-xs sm:max-w-sm md:max-w-md`}
                        >
                          {/* Message Box - Mobile Optimized */}
                          <div
                            className={`px-3 xs:px-3.5 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 rounded-2xl shadow-lg transition-all group/message hover:shadow-xl text-xs sm:text-sm leading-relaxed break-words overflow-wrap-break-word ${
                              isOwn
                                ? "bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm"
                                : "bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-primary))] rounded-tl-sm border border-[rgb(var(--border-secondary))]"
                            }`}
                          >
                            {m.message}
                          </div>

                          {/* Time, Status & Delete Button */}
                          <div
                            className={`flex items-center gap-1.5 sm:gap-2 mt-1 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                          >
                            <span className="text-xs text-[rgb(var(--text-muted))] font-medium">
                              {formatTime(m.time)}
                            </span>
                            
                            {isOwn && (
                              <>
                                {m.sending ? (
                                  <Check className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                ) : m.read ? (
                                  <CheckCheck className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                ) : (
                                  <CheckCheck className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                )}
                              </>
                            )}

                            {isOwn && (
                              <button
                                onClick={() => handleDeleteMessage(m._id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-500/20 rounded-md text-red-400 hover:text-red-300 flex-shrink-0"
                                title="Delete"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area - Mobile Optimized */}
              <div className="px-2 xs:px-2.5 sm:px-3 md:px-4 py-2 xs:py-2.5 sm:py-3 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-t border-[rgb(var(--border-secondary))] flex-shrink-0">
                {/* ✅ ACTION ERRORS */}
                {error && (
                  <div className="mb-1.5 sm:mb-2 p-2 sm:p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-1.5 animate-in fade-in slide-in-from-top duration-200">
                    <AlertCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0" />
                    <span className="line-clamp-1">{error}</span>
                  </div>
                )}
                <div className="flex items-end gap-1 xs:gap-1.5 sm:gap-2">
                  {/* Hidden on mobile, visible on xs+ */}
                  <div className="hidden xs:flex gap-0.5 xs:gap-1">
                    <button className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0">
                      <Smile className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                    <button className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0">
                      <Paperclip className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                  />

                  {/* Message Input - Theme Aware & Mobile Responsive */}
                  <div className="flex-1 rounded-2xl border border-[rgb(var(--border-secondary))]/60 bg-[rgb(var(--bg-tertiary))]/40 backdrop-blur-md focus-within:border-green-500/80 focus-within:ring-2 focus-within:ring-green-500/40 transition-all duration-200 min-w-0 hover:border-[rgb(var(--border-secondary))]/80">
                    <textarea
                      ref={messageInputRef}
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        handleChatTyping(e.target.value.length > 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                          handleChatTyping(false);
                        }
                      }}
                      onBlur={() => handleChatTyping(false)}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-2.5 sm:px-3.5 md:px-4 py-2 sm:py-2.5 md:py-3 bg-transparent text-xs sm:text-sm md:text-base text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))]/70 resize-none focus:outline-none max-h-32 custom-scrollbar transition-colors"
                      style={{ minHeight: "44px" }}
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={() => {
                      handleSendMessage();
                      handleChatTyping(false);
                    }}
                    disabled={!messageInput.trim()}
                    className={`p-1.5 sm:p-2 md:p-3 rounded-lg transition-all shadow-lg flex-shrink-0 ${
                      messageInput.trim()
                        ? "bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white glow-green"
                        : "bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-muted))] cursor-not-allowed"
                    }`}
                  >
                    <Send className="w-3.5 sm:w-4 md:w-5 h-3.5 sm:h-4 md:h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State - Mobile Safe */
            <div className="flex-1 flex flex-col items-center justify-center text-[rgb(var(--text-muted))] p-3 xs:p-4 sm:p-6 min-h-0">
              <div className="w-20 xs:w-24 sm:w-32 h-20 xs:h-24 sm:h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-3 xs:mb-4 sm:mb-6 shadow-2xl">
                <MessageCircle className="w-10 xs:w-12 sm:w-16 h-10 xs:h-12 sm:h-16 text-green-500/50" />
              </div>
              <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 xs:mb-2 sm:mb-3 gradient-text text-center">
                Welcome to Pandav Chat
              </h3>
              <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] text-center max-w-sm px-2">
                Select a friend from the sidebar
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
