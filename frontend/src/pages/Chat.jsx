import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import messageService from "@services/message.service.js";
import axios from "axios";
import { SOCKET_EVENTS } from "@constants/socketEvents.js";
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
} from "lucide-react";

export default function Chat({
  allUsers,
  setAllUsers,
  currentUserName,
  currentUserId,
  bgImage,
  bgImages,
  sidebarOpen,
  setSidebarOpen,
  token,
}) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Chat States
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [pinnedChats, setPinnedChats] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const typingTimeoutRef = useRef(null);
  const lastTypingTimeRef = useRef(0);

  // Fetch all users
  const fetchAllUsers = useCallback(async () => {
    try {
      console.log("🔄 Fetching all users...");
      const response = await axios.get("/users", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      console.log("✅ Users fetched:", response.data.data);
      if (response.data.success) {
        const users = response.data.data || [];
        setAllUsers(
          users.map((u) => ({
            userId: u._id || u.userId,
            name: u.name,
            email: u.email,
            online: false,
            lastSeen: u.lastSeen,
            createdAt: u.createdAt,
          }))
        );
      }
    } catch (err) {
      console.error("❌ Failed to fetch all users:", err);
    }
  }, [token, setAllUsers]);

  useEffect(() => {
    if (!token) return;
    fetchAllUsers();
  }, [token, fetchAllUsers]);

  // Socket event handlers - Main useEffect
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    let socket = connectSocket(token);
    if (!socket) return;

    // ✅ ONLINE USERS HANDLER
    const handleOnlineUsers = (users) => {
      console.log("📡 [ONLINE_USERS] Received:", users?.length, "users");
      if (users && users.length > 0) {
        setAllUsers((prevUsers) => {
          if (prevUsers.length === 0) {
            return users.map((u) => ({
              userId: u.userId || u._id,
              name: u.name,
              email: u.email || "",
              online: u.online || true,
              lastSeen: u.lastSeen,
              createdAt: u.createdAt,
            }));
          }

          const updated = prevUsers.map((u) => {
            const onlineUser = users.find(
              (ou) => ou.userId === u.userId || ou._id === u.userId
            );
            if (onlineUser && u.online !== onlineUser.online) {
              return { ...u, online: onlineUser.online || true };
            }
            return u;
          });

          const hasChanges = updated.some(
            (u, i) => u.online !== prevUsers[i].online
          );
          return hasChanges ? updated : prevUsers;
        });
      }
    };

    // ✅ INCOMING MESSAGE HANDLER
    const handlePrivateMessage = (data) => {
      if (!data._id || !data.fromUserId || !data.message) {
        console.error("❌ Invalid message data:", data);
        return;
      }

      const isInCurrentChat = data.fromUserId === selectedUserId;

      setMessages((prev) => {
        // ✅ Check if message already exists
        const messageExists = prev.some((m) => m._id === data._id);
        if (messageExists) {
          console.warn(`⚠️ Message ${data._id} already exists, skipping`);
          return prev;
        }

        const newMessage = {
          _id: data._id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || "Unknown",
          toUserId: data.toUserId || currentUserId,
          message: data.message,
          time: data.time || data.createdAt || new Date().toISOString(),
          read: isInCurrentChat,
          delivered: data.delivered || true,
        };

        return [...prev, newMessage];
      });

      if (isInCurrentChat) {
        // ✅ Auto-mark as read when chat is open
        setTimeout(() => {
          socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
            messageId: data._id,
            senderId: data.fromUserId,
            receiverId: currentUserId,
          });
        }, 50);
      } else {
        // ✅ Add to unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [data.fromUserId]: (prev[data.fromUserId] || 0) + 1,
        }));
      }
    };

    // ✅ MESSAGE SENT CONFIRMATION - Just add to UI with real ID
    const handleMessageSent = (data) => {
      console.log("✅ [MESSAGE_SENT] Confirmed:", {
        _id: data._id,
        message: data.message.substring(0, 30)
      });

      // ✅ Add message to UI with REAL MongoDB ID
      setMessages((prev) => {
        const messageExists = prev.some((m) => m._id === data._id);
        if (messageExists) {
          console.warn(`⚠️ Message ${data._id} already in state`);
          return prev;
        }

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

    // ✅ MESSAGE READ - Simple read status update
    const handleMessageRead = (data) => {
      console.log("🔵 [MESSAGE_READ]:", data.messageId);

      setMessages((prev) => {
        const messageExists = prev.find((m) => m._id === data.messageId);
        
        if (!messageExists) {
          console.warn(`⚠️ Message ${data.messageId} not found`);
          return prev;
        }

        if (messageExists.read) {
          console.log(`ℹ️ Message already read`);
          return prev;
        }

        return prev.map((m) => 
          m._id === data.messageId ? { ...m, read: true } : m
        );
      });
    };

    // ✅ USER OFFLINE HANDLER
    const handleUserOffline = ({ toUserId }) => {
      setAllUsers((prevUsers) => {
        const userIndex = prevUsers.findIndex((u) => u.userId === toUserId);
        if (userIndex !== -1 && prevUsers[userIndex].online) {
          const updated = [...prevUsers];
          updated[userIndex] = { ...updated[userIndex], online: false };
          return updated;
        }
        return prevUsers;
      });
    };

    // ✅ TYPING HANDLER
    const handleTyping = ({ fromUserId, isTyping }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [fromUserId]: isTyping,
      }));
    };

    // ✅ MESSAGE DELETED HANDLER
    const handleMessageDeleted = (data) => {
      console.log("🗑️ [MESSAGE_DELETED] Received:", data);
      setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
    };

    // Register all listeners
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
  }, [token, navigate, currentUserId, currentUserName, setAllUsers,selectedUserId]); // ✅ Fixed dependencies

  // ✅ FETCH CHAT HISTORY - Separate useEffect
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

        // ✅ Mark unread messages as read
        const unreadMessages = messagesWithIds.filter(
          (msg) => msg.fromUserId === selectedUserId && !msg.read
        );

        if (unreadMessages.length > 0) {
          const socket = getSocket();
          if (socket && socket.connected) {
            unreadMessages.forEach((msg) => {
              console.log(`📤 [Frontend] Emitting READ_RECEIPT for ${msg._id}`);
              console.log(`📤 [Frontend] senderId: ${msg.fromUserId}, receiverId: ${currentUserId}`);
      
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
          }
        }
      } catch (err) {
        console.error("❌ Failed to fetch chat history:", err);
        setError(err.message);
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
  }, [selectedUserId, currentUserId]); // ✅ Fixed dependencies

  // ✅ ADD THIS NEW EFFECT: Poll for read status updates
  useEffect(() => {
    if (!selectedUserId) return;

    // Poll every 2 seconds to check if messages were marked as read
    const pollInterval = setInterval(async () => {
      try {
        const data = await messageService.fetchChatHistory(selectedUserId);
        
        setMessages((prev) => {
          let hasChanges = false;
          const updated = prev.map((msg) => {
            // Only check sent messages from current user
            if (msg.fromUserId === currentUserId && !msg.read) {
              const updatedMsg = data.messages.find((m) => m._id === msg._id);
              
              // If message is marked as read in DB but not in UI
              if (updatedMsg && updatedMsg.read) {
                console.log(`🔵 [POLL] Blue tick appeared for: ${msg._id}`);
                hasChanges = true;
                return { ...msg, read: true };
              }
            }
            return msg;
          });

          return hasChanges ? updated : prev;
        });
      } catch (err) {
        console.debug("[POLL] Read status check failed");
        console.log(err)
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [selectedUserId, currentUserId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const usersToFilter = allUsers;

    return usersToFilter
      .filter((user) => user.userId !== currentUserId)
      .filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
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
  }, [allUsers, currentUserId, searchQuery, pinnedChats, unreadCounts]);

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
      setError("Connection error. Please refresh.");
      return;
    }

    if (!selectedUserId || !messageInput.trim()) return;

      console.log("📤 [SEND] Sending message:", messageInput.trim());

      // ✅ Just emit to backend - DON'T add to UI yet
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

  return (
    <>
      {/* Chat Sidebar */}
      <div
        className={`${sidebarOpen ? "w-full  sm:w-72 md:w-80" : "w-0"} bg-[rgb(var(--bg-secondary))] sm:glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col transition-all duration-300 overflow-hidden absolute sm:relative sm:z-0 z-40 h-full sm:h-auto`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-300">Chats</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 sm:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 px-4">
            <MessageCircle className="w-4 h-4" />
            Conversations ({filteredUsers.length})
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No chats found</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const id = user.userId;
              const name = user.name;
              const isPinned = pinnedChats.includes(id);
              const unreadCount = unreadCounts[id] || 0;
              const isOnline = user.online;

              return (
                <div
                  key={id}
                  onClick={() => setSelectedUserId(id)}
                  className={`group relative p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all ${
                    selectedUserId === id
                      ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                      : "hover:bg-[rgb(var(--bg-hover))]/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-gray-100 font-bold text-lg shadow-lg ${
                          isOnline
                            ? "bg-linear-to-br from-green-500 to-teal-600"
                            : "bg-linear-to-br from-gray-500 to-gray-600"
                        }`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[rgb(var(--bg-secondary))] rounded-full ${
                          isOnline ? "bg-green-400 pulse-glow" : "bg-gray-400"
                        }`}
                      ></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h5 className="font-semibold text-gray-600 truncate">
                            {name}
                          </h5>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-green-400 shrink-0" />
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-xs mt-1 ${isOnline ? "text-green-500" : "text-gray-500"}`}
                      >
                        {typingUsers[id] ? (
                          <span className="text-green-400">Typing...</span>
                        ) : isOnline ? (
                          <span className="flex items-center gap-1">
                            <Circle className="w-1.5 h-1.5 fill-green-500" />
                            Online
                          </span>
                        ) : (
                          "Offline"
                        )}
                      </p>
                    </div>

                    {unreadCount > 0 && (
                      <div className="w-6 h-6 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-black shadow-lg glow-green shrink-0">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinChat(id);
                    }}
                    className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                      isPinned
                        ? "text-green-400 bg-green-500/20"
                        : "text-gray-400 hover:bg-[rgb(var(--bg-hover))] hover:text-green-400"
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[rgb(var(--bg-primary))]">
        {selectedUserId ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 sm:hidden"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="relative shrink-0">
                  <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-gray-100 font-bold shadow-lg glow-green text-sm sm:text-base">
                    {getDisplayName(selectedUserId).charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 sm:w-3 h-2.5 sm:h-3 bg-green-400 border-2 border-[rgb(var(--bg-primary))] rounded-full pulse-glow"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-700 text-base sm:text-lg truncate">
                    {getDisplayName(selectedUserId)}
                  </h3>
                  <p className="text-xs text-green-400 font-medium">
                    {typingUsers[selectedUserId] ? "Typing..." : "Active Now"}
                  </p>
                </div>
              </div>
              <button className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 shrink-0">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">Loading messages...</p>
                  </div>
                </div>
              ) : currentChatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="w-24 h-24 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-lg">
                    <MessageCircle className="w-12 h-12 text-green-500/50" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Start Conversation</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Send a message to {getDisplayName(selectedUserId)}!
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
                      className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      {showAvatar ? (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
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
                        <div className="w-8"></div>
                      )}

                      <div
                        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}
                      >
                        <div
                          className={`px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-sm transition-all ${
                            isOwn
                              ? "bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm"
                              : "glass-effect text-white  rounded-tl-sm border border-[rgb(var(--border-secondary))]"
                          }`}
                        >
                          <p
                            className="wrap-break-word  leading-relaxed"
                            style={{
                              color: bgImages[bgImage].textColor,
                            }}
                          >
                            {m.message}
                          </p>
                        </div>

                        <div
                          className={`flex items-center gap-2 mt-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                        >
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTime(m.time)}
                          </span>
                          {isOwn && (
                            <>
                              {m.sending ? (
                                // ✅ Single tick - sending
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              ) : m.read ? (
                                // ✅ Double tick - delivered AND read
                                <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                              ) : (
                                // ✅ Double tick - delivered but not read
                                <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-t border-[rgb(var(--border-secondary))]">
              {error && (
                <div className="mb-3 p-2 sm:p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs sm:text-sm">
                  {error}
                </div>
              )}
              <div className="flex items-end gap-2 sm:gap-3">
                <div className="hidden sm:flex gap-1">
                  <button className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                <div className="flex-1 glass-effect rounded-2xl border border-[rgb(var(--border-secondary))] focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
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
                    className="w-full px-4 py-3 bg-transparent text-gray-300 placeholder-gray-500 resize-none focus:outline-none max-h-32 custom-scrollbar"
                    style={{ minHeight: "48px" }}
                  />
                </div>

                <button
                  onClick={() => {
                    handleSendMessage();
                    handleChatTyping(false);
                  }}
                  disabled={!messageInput.trim()}
                  className={`p-2 sm:p-3 rounded-xl transition-all shadow-lg shrink-0 ${
                    messageInput.trim()
                      ? "bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-black glow-green"
                      : "bg-[rgb(var(--bg-tertiary))] text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4">
            <div className="w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-4 sm:mb-6 shadow-2xl">
              <MessageCircle className="w-12 sm:w-16 h-12 sm:h-16 text-green-500/50" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 gradient-text text-center">
              Welcome to Pandav Chat
            </h3>
            <p className="text-gray-500 text-center text-sm sm:text-base max-w-md">
              Select a conversation from the sidebar to start messaging
            </p>
          </div>
        )}
      </div>
    </>
  );
}
