import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import messageService from "@services/message.service.js";
import cryptoService from "@services/crypto.service.js";
import { getAuthUser } from "@/utils/authStorage.js";
import friendAPI from '@api/friend.api.js';
import { SOCKET_EVENTS } from "@constants/socketEvents.js";
import { applyTheme, saveTheme } from "@utils/themeUtils.js";
import { compressImageFile } from "@utils/imageCompression.js";
import { compressVideoFile } from "@utils/videoCompression.js";
import {
  getSocket,
  isSocketConnected,
} from "@socket/socketClient.js";
import {
  MessageCircle,
  Search,
  Pin,
  Circle,
  MoreVertical,
  Phone,
  Video,
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
  Lock,
  ShieldAlert,
} from "lucide-react";
import ThemeChanger from "@/components/ThemeChanger";
import Avatar from "@/components/Avatar";
import EmojiPicker from "@/components/EmojiPicker";
import ReactionBar from "@/components/ReactionBar";
import { showDesktopNotification } from "@utils/notifications.js";
import { useDebounce } from '@hooks/useDebounce';

export default function Chat({
  currentUserName,
  currentUserId,
  avatar: myAvatar,
  token,
  allUsers,
  setAllUsers,
  sidebarOpen,
  setSidebarOpen,
  notificationsEnabled,
  onChatOpen,
  isChatOpen,
  onStartCall,
  callStatus,
}) {
  const navigate = useNavigate();

  // ✅ Helper to ensure sender's public key is available before decryption
  const ensureSenderPublicKey = useCallback(async (senderId) => {
    const pubKey = cryptoService.getPublicKey(senderId);
    if (pubKey) {
      return true;
    }

    const sender = allUsers.find(u => u.userId === senderId);
    if (!sender?.publicKey) {
      console.warn("⚠️ Sender public key not found for:", senderId);
      return false;
    }

    try {
      cryptoService.storePublicKey(senderId, sender.publicKey);
      return true;
    } catch (error) {
      console.error("❌ Failed to load sender public key:", error.message);
      return false;
    }
  }, [allUsers]);

  const getMessagePeerId = useCallback((message) => {
    return String(message.fromUserId) === String(currentUserId)
      ? message.toUserId
      : message.fromUserId;
  }, [currentUserId]);

  const ensureMessagePeerKey = useCallback(async (message) => {
    const peerId = getMessagePeerId(message);
    if (!peerId) {
      return null;
    }

    const existingKey = cryptoService.getPublicKey(peerId);
    if (existingKey) {
      return peerId;
    }

    const peerUser = allUsers.find((user) => String(user.userId) === String(peerId));
    if (!peerUser?.publicKey) {
      console.warn("⚠️ Message peer public key not found for:", peerId);
      return null;
    }

    try {
      cryptoService.storePublicKey(peerId, peerUser.publicKey);
      return peerId;
    } catch (error) {
      console.error("❌ Failed to load message peer public key:", error.message);
      return null;
    }
  }, [allUsers, getMessagePeerId]);

  // ✅ Helper to check if keypair is initialized
  const getEncryptionKey = useCallback(() => {
    if (cryptoService.myKeypair) {
      return true;
    }

    const restored = cryptoService.restoreMyKeypairFromSession(currentUserId);
    if (restored) {
      return true;
    }

    console.warn("❌ Keypair not initialized!");
    return false;
  }, [currentUserId]);

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
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef(null);
  const isInitialLoad = useRef(true);
  const lastScrollHeightRef = useRef(0);

  
  // Wrapper to keep ref in sync
  const setSelectedUserId = useCallback((id) => {
    selectedUserIdRef.current = id;
    setSelectedUserIdState(id);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showThemeChanger, setShowThemeChanger] = useState(false);
  
  //  ADD THIS: Debounce the search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  //  NEW: Socket connection status
  const [socketStatus, setSocketStatus] = useState('connecting');

  // ✅ E2EE: peers whose public key changed since we last pinned it
  // (either a legit key rotation on their end, or the server swapping in
  // a different key — we can't tell which, so we warn instead of guessing)
  const [keyWarnings, setKeyWarnings] = useState({});

  const typingTimeoutRef = useRef(null);
  const lastTypingTimeRef = useRef(0);
  const errorTimeoutRef = useRef(null);
  const selectedUserIdRef = useRef(null); //  TRACK CURRENT SELECTION WITHOUT RE-RENDERS

  //  AUTO-CLEAR ERRORS AFTER 5 SECONDS
  useEffect(() => {
    if (error) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setError("");
      }, 5000);
    }
  }, [error]);

  //  APPLY SAVED THEME ON MOUNT
  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
    applyTheme(savedTheme);
  }, []);

  // ✅ E2EE: Clear keys when user logs out (token becomes falsy)
  useEffect(() => {
    if (!token) {
      cryptoService.clearAllKeys();
    }
  }, [token]);

  // ✅ E2EE: Listen for pinned-key mismatches (see crypto.service.js storePublicKey)
  useEffect(() => {
    const handleKeyChanged = (e) => {
      const { userId, oldPublicKey, newPublicKey } = e.detail || {};
      if (!userId) return;
      setKeyWarnings((prev) => ({ ...prev, [userId]: { oldPublicKey, newPublicKey } }));
    };

    window.addEventListener(cryptoService.KEY_CHANGED_EVENT, handleKeyChanged);
    return () => window.removeEventListener(cryptoService.KEY_CHANGED_EVENT, handleKeyChanged);
  }, []);

  const handleTrustKeyChange = useCallback((userId) => {
    const warning = keyWarnings[userId];
    if (!warning) return;

    cryptoService.trustKeyChange(userId, warning.newPublicKey);
    setKeyWarnings((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  }, [keyWarnings]);


  //  COMPREHENSIVE PROTECTION: NO BACK, NO CLOSE, NO SWIPE-BACK
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

  //  FETCH ONLY FRIENDS (not all users)
  const fetchFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);

      const response = await friendAPI.getFriends();

      if (response.data.success) {
        const rawData = response.data?.data;
        const friends = Array.isArray(rawData) ? rawData : (rawData?.data || []);

        const friendsList = friends.map((u) => ({
          userId: u._id || u.userId,
          name: u.name,
          email: u.email,
          avatar: u.avatar || null,
          publicKey: u.publicKey || null,
          online: !!u.isOnline,
          lastSeen: u.lastSeen || null,
          createdAt: u.createdAt,
        }));

        setAllUsers(friendsList);

        // ✅ E2EE: Pre-load ALL friends' public keys on startup
        // This ensures we can decrypt messages from anyone before they arrive
        let preloadedKeyCount = 0;
        for (const friend of friendsList) {
          if (friend.publicKey) {
            try {
              cryptoService.storePublicKey(friend.userId, friend.publicKey);
              preloadedKeyCount += 1;
            } catch (keyError) {
              console.warn("⚠️ Could not pre-load key for", friend.name, ":", keyError.message);
            }
          }
        }

        setError("");
      }
    } catch (err) {
      console.error("❌ Failed to fetch friends:", err.message);
      setError("⚠️ Failed to load friends. Please refresh.");
    } finally {
      setLoadingFriends(false);
    }
  }, [setAllUsers]);

  //  FETCH FRIENDS ON MOUNT
  useEffect(() => {
    if (!token) return;
    fetchFriends();
  }, [token, fetchFriends]);

  //  HANDLE FRIEND REMOVAL - REFETCH FRIENDS
  const handleFriendRemoved = useCallback((removedUserId) => {
    setAllUsers(prevUsers => {
      return prevUsers.filter(user => user.userId !== removedUserId);
    });

    if (selectedUserId === removedUserId) {
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
      fetchFriends();
    }, 300);
  }, [selectedUserId, fetchFriends, setAllUsers]);

  useEffect(() => {
    //  PHASE 6: CLEAN SOCKET INITIALIZATION
    let socketInitInterval;
    let cleanup;

    //  ONLINE USERS HANDLER
    const handleOnlineUsers = (users = []) => {
      setAllUsers((prevUsers) => {
        return prevUsers.map((friendUser) => {
          const onlineUser = users.find(
            (ou) => String(ou.userId) === String(friendUser.userId)
          );
          return {
            ...friendUser,
            online: !!onlineUser,
            lastSeen: onlineUser?.lastSeen || friendUser.lastSeen,
          };
        });
      });
    };

    //  INCOMING MESSAGE HANDLER
    const handlePrivateMessage = async (data) => {
      const isInCurrentChat = String(data.fromUserId) === String(selectedUserIdRef.current);

      // ✅ E2EE: Decrypt encrypted messages BEFORE state update
      let messageText = data.message;
      let decrypted = false;
      const isMedia = data.messageType === 'image' || data.messageType === 'video';

      if (isMedia) {
        try {
          if (!getEncryptionKey()) {
            messageText = "[Decryption failed - keypair not initialized]";
          } else {
            const hasKey = await ensureSenderPublicKey(data.fromUserId);
            if (!hasKey) {
              messageText = "[Decryption failed - sender public key unavailable]";
            } else {
              const imageBytes = await cryptoService.decryptImage(
                data.message, data.imageCiphertext, data.imageNonce, data.fromUserId
              );
              messageText = cryptoService.imageBytesToDataUrl(imageBytes, data.imageMimeType);
              decrypted = true;
            }
          }
        } catch (error) {
          console.error("❌ Media decryption failed:", error.message);
          messageText = null;
          decrypted = false;
        }
      } else if (data.isEncrypted && cryptoService.isEncrypted(data.message)) {
        try {
          if (!getEncryptionKey()) {
            messageText = "[Decryption failed - keypair not initialized]";
            console.error("❌ No keypair!");
          } else {
            // ✅ Ensure sender's public key is loaded before decrypting
            const hasKey = await ensureSenderPublicKey(data.fromUserId);
            if (!hasKey) {
              messageText = "[Decryption failed - sender public key unavailable]";
              console.error("❌ Sender public key not found:", data.fromUserId);
            } else {
              messageText = await cryptoService.decryptMessage(data.message, data.fromUserId);
              decrypted = true;
              console.log("✅ Message decrypted successfully from:", data.fromUserId);
            }
          }
        } catch (error) {
          console.error("❌ Decryption failed:", error.message);
          messageText = "[Decryption failed]";
          decrypted = false;
        }
      } else {
        decrypted = true; // Plaintext message
      }

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(data._id))) return prev;

        const newMessage = {
          _id: data._id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || "Unknown",
          toUserId: data.toUserId || currentUserId,
          message: messageText,
          messageType: data.messageType || 'text',
          reactions: data.reactions || [],
          time: data.time || new Date().toISOString(),
          read: isInCurrentChat,
          delivered: true,
          isEncrypted: data.isEncrypted,
          decrypted,
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

      // Only notify for messages the user isn't already looking at — either
      // a different chat is open, or this one is but the tab itself isn't focused.
      if (notificationsEnabled && (!isInCurrentChat || document.hidden)) {
        const senderAvatar = allUsers.find((u) => u.userId === data.fromUserId)?.avatar;
        showDesktopNotification(data.fromUserName || "New message", {
          body: data.messageType === 'video' ? "🎥 Sent a video" : data.messageType === 'image' ? "📷 Sent a photo" : (decrypted ? messageText : "New message"),
          icon: senderAvatar || undefined,
          tag: `chat-${data.fromUserId}`,
        });
      }
    };

    //  MESSAGE SENT CONFIRMATION
    const handleMessageSent = async (data) => {
      // ✅ For sent messages: we already showed plaintext optimistically
      // The server echo just confirms delivery + gets the _id
      // No need to decrypt - we already know the plaintext
      setMessages((prev) => {
        // Match the exact optimistic message this ack confirms via the
        // uniqueId we sent with it, rather than just grabbing the first
        // "temp_" message — rapid sends can have their acks arrive out of
        // order, which used to swap real _ids onto the wrong message.
        const tempIndex = data.uniqueId
          ? prev.findIndex((m) => m.uniqueId === data.uniqueId)
          : prev.findIndex((m) => String(m._id).startsWith("temp_"));
        if (tempIndex !== -1) {
          // Replace temp message with server's confirmed version (keeps plaintext)
          const updated = [...prev];
          updated[tempIndex] = {
            ...updated[tempIndex],
            _id: data._id, // Replace temp _id with real _id
            delivered: true,
            read: false,
          };
          return updated;
        }

        // If temp message wasn't found, add it (shouldn't happen)
        if (prev.some((m) => String(m._id) === String(data._id))) return prev;

        return [
          ...prev,
          {
            _id: data._id,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            fromUserName: data.fromUserName || currentUserName,
            message: data.message, // Keep original (already plaintext from our send)
            messageType: data.messageType || 'text',
            reactions: [],
            time: data.time,
            delivered: true,
            read: false,
            isEncrypted: data.isEncrypted,
            decrypted: true,
          }
        ];
      });
    };

    //  MESSAGE READ HANDLER
    const handleMessageRead = (data) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => String(m._id) === String(data.messageId));
        if (index === -1) return prev;
        if (prev[index].read) return prev;

        const updated = [...prev];
        updated[index] = { ...updated[index], read: true };
        return updated;
      });
    };

    //  USER OFFLINE HANDLER
    const handleUserOffline = ({ userId: offlineUserId, lastSeen }) => {
      setAllUsers((prev) => prev.map(u => 
        String(u.userId) === String(offlineUserId) ? { ...u, online: false, lastSeen: lastSeen || new Date().toISOString() } : u
      ));
    };

    //  TYPING HANDLER
    const handleTyping = ({ fromUserId, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [fromUserId]: isTyping }));
    };

    //  MESSAGE DELETED HANDLER
    const handleMessageDeleted = (data) => {
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(data.messageId)));
    };

    //  MESSAGE REACTION HANDLER
    const handleMessageReactionEvent = (data) => {
      setMessages((prev) => prev.map((m) => (
        String(m._id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
      )));
    };

    // ✅ Real-time: someone accepting your friend request (or removing you)
    // used to only be reflected here after a manual refresh. Refetch the
    // friends list live instead.
    const handleFriendListChanged = () => {
      fetchFriends();
    };

    // Every socket handler on the backend (rate limiting, friend checks,
    // save failures, etc.) reports failures via ERROR_MESSAGE — nothing
    // here was ever listening for it, so a rejected send just silently
    // stayed on-screen as if it had gone through, with no signal to the
    // user that it never actually reached the server.
    const handleErrorMessage = (data) => {
      setError(`⚠️ ${data?.message || 'Something went wrong.'}`);

      // private-message.handler.js now echoes back the uniqueId of the
      // send that failed. Without this, a rejected send left its
      // optimistic bubble on screen forever — still stamped
      // delivered:true — since only a successful MESSAGE_SENT ack ever
      // replaces a temp_ message; the banner above told the user
      // *something* failed, but the UI kept lying about that specific
      // message having gone through.
      if (data?.uniqueId) {
        setMessages((prev) => prev.filter((m) => m.uniqueId !== data.uniqueId));
      }
    };

    const registerListeners = (socket) => {
      const onConnect = () => {
        setSocketStatus('connected');
        setError('');
      };

      const onDisconnect = (reason) => {
        setSocketStatus('disconnected');
        setError(`📴 Connection lost: ${reason}`);
      };

      const onConnectError = (error) => {
        console.error('🔴 Socket error:', error.message);
        setSocketStatus('error');
        setError(`🔴 Connection Error: ${error.message}`);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
      socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
      socket.on(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
      socket.on(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
      socket.on(SOCKET_EVENTS.TYPING, handleTyping);
      socket.on(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
      socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.on(SOCKET_EVENTS.MESSAGE_REACTION, handleMessageReactionEvent);
      socket.on(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, handleFriendListChanged);
      socket.on(SOCKET_EVENTS.FRIEND_REMOVED, handleFriendListChanged);
      socket.on(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage);

      // Handle the race where the socket connects before listeners are attached.
      if (socket.connected) {
        onConnect();
      } else {
        setSocketStatus('connecting');
      }

      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
        socket.off(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
        socket.off(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
        socket.off(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
        socket.off(SOCKET_EVENTS.TYPING, handleTyping);
        socket.off(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
        socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
        socket.off(SOCKET_EVENTS.MESSAGE_REACTION, handleMessageReactionEvent);
        socket.off(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, handleFriendListChanged);
        socket.off(SOCKET_EVENTS.FRIEND_REMOVED, handleFriendListChanged);
        socket.off(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage);
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
  }, [token, navigate, currentUserId, currentUserName, setAllUsers, fetchFriends, notificationsEnabled]);

  //  FETCH CHAT HISTORY
  useEffect(() => {
    if (!selectedUserId) return;

    const fetchChatHistory = async () => {
      setLoading(true);
      isInitialLoad.current = true;
      try {
        // ✅ E2EE: Pre-load recipient's and all participants' public keys
        const recipient = allUsers.find(u => u.userId === selectedUserId);
        const usersToPreload = [recipient].filter(Boolean); // Only recipient in 1-on-1 chat

        for (const user of usersToPreload) {
          if (user?.publicKey) {
            try {
              cryptoService.storePublicKey(user.userId, user.publicKey);
            } catch (keyError) {
              console.warn("⚠️ Could not pre-load public key for", user.userId, ":", keyError.message);
            }
          }
        }

        const data = await messageService.fetchChatHistory(selectedUserId);

        // ✅ E2EE: Decrypt messages on history load
        const messagesWithIds = await Promise.all(
          data.messages.map(async (msg) => {
            let messageText = msg.message;
            let decrypted = false;
            const isMedia = msg.messageType === 'image' || msg.messageType === 'video';

            if (isMedia) {
              try {
                if (!getEncryptionKey()) {
                  messageText = "[Decryption failed - keypair not initialized]";
                } else {
                  const peerId = await ensureMessagePeerKey(msg);
                  if (!peerId) {
                    messageText = "[Decryption failed - peer key unavailable]";
                  } else {
                    const imageBytes = await cryptoService.decryptImage(
                      msg.message, msg.imageCiphertext, msg.imageNonce, peerId
                    );
                    messageText = cryptoService.imageBytesToDataUrl(imageBytes, msg.imageMimeType);
                    decrypted = true;
                  }
                }
              } catch (error) {
                console.error("❌ Image decryption failed for history message:", error.message);
                messageText = null;
              }
            } else if (msg.isEncrypted && cryptoService.isEncrypted(msg.message)) {
              try {
                if (!getEncryptionKey()) {
                  messageText = "[Decryption failed - keypair not initialized]";
                } else {
                  const peerId = await ensureMessagePeerKey(msg);
                  if (!peerId) {
                    messageText = "[Decryption failed - peer key unavailable]";
                  } else {
                    messageText = await cryptoService.decryptMessage(msg.message, peerId);
                    decrypted = true;
                  }
                }
              } catch (error) {
                console.error("❌ Decryption failed for history message:", error.message);
                messageText = "[Decryption failed]";
              }
            } else {
              decrypted = true;
            }

            return {
              _id: msg._id,
              fromUserId: msg.fromUserId,
              toUserId: msg.toUserId,
              fromUserName: msg.senderName || "Unknown",
              message: messageText,
              messageType: msg.messageType || 'text',
              reactions: msg.reactions || [],
              time: msg.time,
              read: msg.read,
              createdAt: msg.createdAt,
              isEncrypted: msg.isEncrypted,
              decrypted,
            };
          })
        );

        setMessages(messagesWithIds);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);

        const unreadMessages = messagesWithIds.filter(
          (msg) => msg.fromUserId === selectedUserId && !msg.read
        );

        if (unreadMessages.length > 0) {
          const socket = getSocket();
          if (socket && socket.connected) {
            unreadMessages.forEach((msg) => {
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
        setError("");
      } catch (err) {
        setError(err.message || "Failed to load chat history");
        setMessages([]);
      } finally {
        setLoading(false);
        // Reset initial load flag after a small delay to allow scroll to bottom
        setTimeout(() => { isInitialLoad.current = false; }, 100);
      }
    };

    fetchChatHistory();
    setUnreadCounts((prev) => ({
      ...prev,
      [selectedUserId]: 0,
    }));
    messageInputRef.current?.focus();
  }, [selectedUserId, currentUserId]);

  //  LOAD MORE MESSAGES (Infinite Scroll)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedUserId || loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    // Capture current scroll height before adding messages
    if (scrollContainerRef.current) {
      lastScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }

    try {
      const data = await messageService.fetchChatHistory(selectedUserId, nextCursor);

      // ✅ E2EE: Decrypt older messages on infinite scroll
      const olderMessages = await Promise.all(
        data.messages.map(async (msg) => {
          let messageText = msg.message;
          let decrypted = false;
          const isMedia = msg.messageType === 'image' || msg.messageType === 'video';

          if (isMedia) {
            try {
              if (!getEncryptionKey()) {
                messageText = "[Decryption failed - keypair not initialized]";
              } else {
                const peerId = await ensureMessagePeerKey(msg);
                if (!peerId) {
                  messageText = "[Decryption failed - peer key unavailable]";
                } else {
                  const imageBytes = await cryptoService.decryptImage(
                    msg.message, msg.imageCiphertext, msg.imageNonce, peerId
                  );
                  messageText = cryptoService.imageBytesToDataUrl(imageBytes, msg.imageMimeType);
                  decrypted = true;
                }
              }
            } catch (error) {
              console.error("❌ Image decryption failed for older message:", error.message);
              messageText = null;
            }
          } else if (msg.isEncrypted && cryptoService.isEncrypted(msg.message)) {
            try {
              if (!getEncryptionKey()) {
                messageText = "[Decryption failed - keypair not initialized]";
              } else {
                const peerId = await ensureMessagePeerKey(msg);
                if (!peerId) {
                  messageText = "[Decryption failed - peer key unavailable]";
                } else {
                  messageText = await cryptoService.decryptMessage(msg.message, peerId);
                  decrypted = true;
                }
              }
            } catch (error) {
              console.error("❌ Decryption failed for older message:", error.message);
              messageText = "[Decryption failed]";
            }
          } else {
            decrypted = true;
          }

          return {
            _id: msg._id,
            fromUserId: msg.fromUserId,
            toUserId: msg.toUserId,
            fromUserName: msg.senderName || "Unknown",
            message: messageText,
            messageType: msg.messageType || 'text',
            reactions: msg.reactions || [],
            time: msg.time,
            read: msg.read,
            createdAt: msg.createdAt,
            isEncrypted: msg.isEncrypted,
            decrypted,
          };
        })
      );

      setMessages(prev => [...olderMessages, ...prev]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);

      // Adjust scroll after messages are added
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDiff = newScrollHeight - lastScrollHeightRef.current;
          scrollContainerRef.current.scrollTop = heightDiff;
        }
      });

    } catch (err) {
      setError(err.message || "Failed to load more history");
    } finally {
      setLoadingMore(false);
    }
  }, [selectedUserId, nextCursor, hasMore, loadingMore, ensureMessagePeerKey, getEncryptionKey]);

  //  SCROLL LISTENER FOR INFINITE SCROLL
  const handleScroll = useCallback((e) => {
    const { scrollTop } = e.currentTarget;
    // When user hits the top (or near it)
    if (scrollTop < 50 && hasMore && !loadingMore && !loading) {
      loadMoreMessages();
    }
  }, [hasMore, loadingMore, loading, loadMoreMessages]);


  //  REMOVED inefficient 2-second history polling

  // Auto-scroll
  useEffect(() => {
    // Only auto-scroll to bottom on initial load or if user is already near bottom
    if (messagesEndRef.current && (isInitialLoad.current || !loadingMore)) {
      const isAtBottom = scrollContainerRef.current ? 
        (scrollContainerRef.current.scrollHeight - scrollContainerRef.current.scrollTop - scrollContainerRef.current.clientHeight < 200) : true;
      
      if (isAtBottom || isInitialLoad.current) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: isInitialLoad.current ? "auto" : "smooth" });
        });
      }
    }
  }, [messages, loadingMore]);


  //  HIDE MOBILE BOTTOM NAV WHEN CHAT IS OPEN
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
    //  CHANGE DEPENDENCY: Use debouncedSearchQuery
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
  const handleSendMessage = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !isSocketConnected()) {
      setError("🔴 Not connected. Please refresh.");
      return;
    }

    if (!selectedUserId || !messageInput.trim()) return;

    const plaintext = messageInput.trim();

    try {
      // ✅ E2EE: Check keypair is initialized
      if (!getEncryptionKey()) {
        console.error("❌ Encryption keypair not initialized");
        setError("🔓 Encryption not ready. Please refresh and log in again.");
        return;
      }

      // ✅ Encrypt for recipient using their public key
      // First, ensure we have recipient's public key
      let recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
      if (!recipientPublicKey) {
        const selectedUser = allUsers.find((user) => String(user.userId) === String(selectedUserId));

        if (selectedUser?.publicKey) {
          cryptoService.storePublicKey(selectedUserId, selectedUser.publicKey);
          recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
        }
      }

      if (!recipientPublicKey) {
        console.warn("⚠️ Recipient public key is missing for selected user:", selectedUserId);
        setError("🔐 Recipient encryption key is missing. Ask them to log in again once so their key can be published.");
        return;
      }

      const encryptedMessage = await cryptoService.encryptMessage(plaintext, selectedUserId);

      // Tag this send with a unique id so the MESSAGE_SENT echo can find and
      // replace the exact optimistic message it confirms, instead of just
      // grabbing whichever temp message happens to be first in the array —
      // two rapid sends could otherwise have their real _ids swapped onto
      // the wrong message if the server acks arrive out of order.
      const uniqueId = crypto.randomUUID();

      // Send encrypted blob to recipient
      socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
        toUserId: selectedUserId,
        message: encryptedMessage,
        isEncrypted: true,
        uniqueId,
      });

      // Show plaintext in own UI (optimistic - we know the plaintext)
      setMessages((prev) => [
        ...prev,
        {
          _id: `temp_${uniqueId}`,
          uniqueId,
          fromUserId: currentUserId,
          toUserId: selectedUserId,
          fromUserName: currentUserName,
          message: plaintext,
          time: new Date().toISOString(),
          read: false,
          delivered: true,
          isEncrypted: true,
          decrypted: true, // Already decrypted for sender (we encrypted it)
        },
      ]);
    } catch (err) {
      console.error("❌ Encryption failed:", err.message);
      setError(`🔒 Encryption error: ${err.message}`);
    }

    setMessageInput("");
  }, [selectedUserId, messageInput, currentUserId, currentUserName, allUsers, getEncryptionKey]);

  //  SEND IMAGE MESSAGE
  const [sendingImage, setSendingImage] = useState(false);
  const handleSendImage = useCallback(async (file) => {
    const socket = getSocket();
    if (!socket || !isSocketConnected()) {
      setError("🔴 Not connected. Please refresh.");
      return;
    }
    if (!selectedUserId || !file) return;

    setSendingImage(true);
    try {
      if (!getEncryptionKey()) {
        setError("🔓 Encryption not ready. Please refresh and log in again.");
        return;
      }

      let recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
      if (!recipientPublicKey) {
        const selectedUser = allUsers.find((user) => String(user.userId) === String(selectedUserId));
        if (selectedUser?.publicKey) {
          cryptoService.storePublicKey(selectedUserId, selectedUser.publicKey);
          recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
        }
      }
      if (!recipientPublicKey) {
        setError("🔐 Recipient encryption key is missing. Ask them to log in again once so their key can be published.");
        return;
      }

      const { bytes, mimeType, dataUrl } = await compressImageFile(file, { maxDimension: 1280, quality: 0.7 });
      const { wrappedKey, imageCiphertext, imageNonce, imageMimeType } =
        await cryptoService.encryptImageForRecipient(bytes, mimeType, selectedUserId);

      const uniqueId = crypto.randomUUID();

      socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
        toUserId: selectedUserId,
        message: wrappedKey,
        messageType: "image",
        imageCiphertext,
        imageNonce,
        imageMimeType,
        isEncrypted: true,
        uniqueId,
      });

      setMessages((prev) => [
        ...prev,
        {
          _id: `temp_${uniqueId}`,
          uniqueId,
          fromUserId: currentUserId,
          toUserId: selectedUserId,
          fromUserName: currentUserName,
          message: dataUrl,
          messageType: "image",
          time: new Date().toISOString(),
          read: false,
          delivered: true,
          isEncrypted: true,
          decrypted: true,
        },
      ]);
    } catch (err) {
      console.error("❌ Image send failed:", err.message);
      setError(`🔒 Image send error: ${err.message}`);
    } finally {
      setSendingImage(false);
    }
  }, [selectedUserId, currentUserId, currentUserName, allUsers, getEncryptionKey]);

  //  SEND VIDEO MESSAGE
  const [sendingVideo, setSendingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const handleSendVideo = useCallback(async (file) => {
    const socket = getSocket();
    if (!socket || !isSocketConnected()) {
      setError("🔴 Not connected. Please refresh.");
      return;
    }
    if (!selectedUserId || !file) return;

    setSendingVideo(true);
    try {
      if (!getEncryptionKey()) {
        setError("🔓 Encryption not ready. Please refresh and log in again.");
        return;
      }

      let recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
      if (!recipientPublicKey) {
        const selectedUser = allUsers.find((user) => String(user.userId) === String(selectedUserId));
        if (selectedUser?.publicKey) {
          cryptoService.storePublicKey(selectedUserId, selectedUser.publicKey);
          recipientPublicKey = cryptoService.getPublicKey(selectedUserId);
        }
      }
      if (!recipientPublicKey) {
        setError("🔐 Recipient encryption key is missing. Ask them to log in again once so their key can be published.");
        return;
      }

      const { bytes, mimeType, dataUrl } = await compressVideoFile(file, { onStatus: setVideoStatus });
      setVideoStatus("Encrypting…");
      const { wrappedKey, imageCiphertext, imageNonce, imageMimeType } =
        await cryptoService.encryptImageForRecipient(bytes, mimeType, selectedUserId);

      const uniqueId = crypto.randomUUID();

      socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
        toUserId: selectedUserId,
        message: wrappedKey,
        messageType: "video",
        imageCiphertext,
        imageNonce,
        imageMimeType,
        isEncrypted: true,
        uniqueId,
      });

      setMessages((prev) => [
        ...prev,
        {
          _id: `temp_${uniqueId}`,
          uniqueId,
          fromUserId: currentUserId,
          toUserId: selectedUserId,
          fromUserName: currentUserName,
          message: dataUrl,
          messageType: "video",
          time: new Date().toISOString(),
          read: false,
          delivered: true,
          isEncrypted: true,
          decrypted: true,
        },
      ]);
    } catch (err) {
      console.error("❌ Video send failed:", err.message);
      setError(`🔒 Video send error: ${err.message}`);
    } finally {
      setSendingVideo(false);
      setVideoStatus("");
    }
  }, [selectedUserId, currentUserId, currentUserName, allUsers, getEncryptionKey]);

  const handleFileSelected = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type.startsWith("video/")) {
      handleSendVideo(file);
    } else {
      handleSendImage(file);
    }
  }, [handleSendImage, handleSendVideo]);

  //  EMOJI PICKER
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const insertEmoji = useCallback((emoji) => {
    const textarea = messageInputRef.current;
    if (textarea && typeof textarea.selectionStart === "number") {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      setMessageInput((prev) => prev.slice(0, start) + emoji + prev.slice(end));
      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + emoji.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    } else {
      setMessageInput((prev) => prev + emoji);
    }
  }, []);

  //  PASTE IMAGE/VIDEO FROM CLIPBOARD (e.g. screenshot copy -> Ctrl+V)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("video/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleSendVideo(file);
        return;
      }
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleSendImage(file);
        return;
      }
    }
  }, [handleSendImage, handleSendVideo]);

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

  //  DELETE MESSAGE HANDLER
  //  REACT TO MESSAGE
  const sendReaction = useCallback((messageId, emoji) => {
    const socket = getSocket();
    if (!socket || !isSocketConnected()) return;
    socket.emit(SOCKET_EVENTS.MESSAGE_REACTION, { messageId, emoji });
  }, []);

  const handleDeleteMessage = useCallback(
    async (messageId) => {
      const confirmed = window.confirm("Are you sure you want to delete this message?");
      if (!confirmed) return;

      try {
        console.log("🗑️ [DELETE] Deleting message:", messageId);

        const socket = getSocket();
        if (!socket || !isSocketConnected()) {
          setError("🔴 Not connected. Please refresh.");
          return;
        }

        setMessages((prev) => {
          const updated = prev.filter((m) => m._id !== messageId);
          console.log(` [DELETE] Message removed from UI:`, messageId);
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

  //  EXPORT HANDLER FOR PARENT COMPONENT
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

      {/*  SOCKET STATUS BAR */}
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

                  const openThisChat = () => {
                    setSelectedUserId(id);
                    if (window.innerWidth < 640) {
                      setSidebarOpen(false);
                    }
                  };

                  return (
                    <div
                      key={id}
                      onClick={openThisChat}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        // Guard against the nested Pin <button> below: Enter/
                        // Space on it fires a keydown that bubbles up here
                        // too, which would otherwise also open the chat.
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openThisChat();
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
                        <Avatar src={user.avatar} name={name} online={isOnline} size="md" />

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
                        title={isPinned ? "Unpin chat" : "Pin chat"}
                        aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-all ${
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
                        setSidebarOpen(true); //  OPEN SIDEBAR ON MOBILE
                      }
                    }}
                    title="Back to friends list"
                    aria-label="Back to friends list"
                    className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0"
                  >
                    <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                  </button>

                  {/* User Avatar & Info - Mobile Safe */}
                  <Avatar
                    src={allUsers.find(u => u.userId === selectedUserId)?.avatar}
                    name={getDisplayName(selectedUserId)}
                    online={allUsers.find(u => u.userId === selectedUserId)?.online}
                    size="sm"
                  />

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

                {/* Call Buttons */}
                {(() => {
                  const canCall = allUsers.find(u => u.userId === selectedUserId)?.online && callStatus === 'idle';
                  return (
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        onClick={() => canCall && onStartCall?.(selectedUserId, getDisplayName(selectedUserId), 'audio')}
                        disabled={!canCall}
                        title="Voice call"
                        aria-label="Voice call"
                        className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Phone className="w-4 sm:w-5 h-4 sm:h-5" />
                      </button>
                      <button
                        onClick={() => canCall && onStartCall?.(selectedUserId, getDisplayName(selectedUserId), 'video')}
                        disabled={!canCall}
                        title="Video call"
                        aria-label="Video call"
                        className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Video className="w-4 sm:w-5 h-4 sm:h-5" />
                      </button>
                    </div>
                  );
                })()}

                {/* More Options Button */}
                <button
                  title="More options"
                  aria-label="More options"
                  className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0"
                >
                  <MoreVertical className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>

              {/* ✅ E2EE: Security key changed warning */}
              {keyWarnings[selectedUserId] && (
                <div className="px-3 sm:px-4 py-2.5 bg-red-500/10 border-b border-red-500/30 text-red-400 flex items-start sm:items-center gap-2 text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="flex-1">
                    {getDisplayName(selectedUserId)}'s security key changed. This could mean they reinstalled/reset their account — or someone is intercepting this chat. Verify with them before trusting it.
                  </span>
                  <button
                    onClick={() => handleTrustKeyChange(selectedUserId)}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 font-medium transition-colors"
                  >
                    Trust new key
                  </button>
                </div>
              )}

              {/* Messages Area - Mobile Optimized */}
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-2 xs:px-2.5 sm:px-3 md:px-4 lg:px-6 py-2 xs:py-2.5 sm:py-3 md:py-4 space-y-1 xs:space-y-2 sm:space-y-3 md:space-y-4 custom-scrollbar min-h-0"
              >
                {loadingMore && (
                  <div className="flex justify-center py-2">
                    <Loader className="w-5 h-5 text-green-500 animate-spin" />
                  </div>
                )}

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
                          <Avatar
                            src={isOwn ? myAvatar : allUsers.find((u) => u.userId === m.fromUserId)?.avatar}
                            name={isOwn ? currentUserName : m.fromUserName}
                            size="sm"
                          />
                        ) : (
                          <div className="w-8 shrink-0"></div>
                        )}

                        {/* Message Bubble - Responsive Width */}
                        <div
                          className={`flex flex-col ${isOwn ? "items-end" : "items-start"} w-full max-w-xs sm:max-w-sm md:max-w-md`}
                        >
                          {/* Message Box - Mobile Optimized */}
                          {m.messageType === 'image' ? (
                            m.message ? (
                              <img
                                src={m.message}
                                alt="Shared image"
                                className="max-w-[220px] xs:max-w-[260px] sm:max-w-xs rounded-2xl shadow-lg object-cover"
                              />
                            ) : (
                              <div className="px-3 xs:px-3.5 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 rounded-2xl shadow-lg text-xs sm:text-sm leading-relaxed bg-[rgb(var(--bg-tertiary))] text-red-400 border border-[rgb(var(--border-secondary))]">
                                [Image could not be decrypted]
                              </div>
                            )
                          ) : m.messageType === 'video' ? (
                            m.message ? (
                              <video
                                src={m.message}
                                controls
                                className="max-w-[220px] xs:max-w-[260px] sm:max-w-xs rounded-2xl shadow-lg"
                              />
                            ) : (
                              <div className="px-3 xs:px-3.5 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 rounded-2xl shadow-lg text-xs sm:text-sm leading-relaxed bg-[rgb(var(--bg-tertiary))] text-red-400 border border-[rgb(var(--border-secondary))]">
                                [Video could not be decrypted]
                              </div>
                            )
                          ) : (
                            <div
                              className={`px-3 xs:px-3.5 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 rounded-2xl shadow-lg transition-all group/message hover:shadow-xl text-xs sm:text-sm leading-relaxed break-words overflow-wrap-break-word ${
                                isOwn
                                  ? "bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm"
                                  : "bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-primary))] rounded-tl-sm border border-[rgb(var(--border-secondary))]"
                              }`}
                            >
                              {m.message}
                            </div>
                          )}

                          {/* Time, Status & Delete Button */}
                          <div
                            className={`flex items-center gap-1.5 sm:gap-2 mt-1 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                          >
                            <span className="text-xs text-[rgb(var(--text-muted))] font-medium">
                              {formatTime(m.time)}
                            </span>

                            {/* ✅ E2EE: Show lock icon for encrypted messages */}
                            {m.isEncrypted && (
                              <Lock
                                className="w-3 h-3 text-amber-500 flex-shrink-0"
                                title="Message is encrypted"
                              />
                            )}

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
                                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-500/20 rounded-md text-red-400 hover:text-red-300 flex-shrink-0"
                                title="Delete"
                                aria-label="Delete message"
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

                          {m._id && !String(m._id).startsWith("temp_") && (
                            <div className="mt-1 px-1">
                              <ReactionBar
                                reactions={m.reactions}
                                currentUserId={currentUserId}
                                onToggle={(emoji) => sendReaction(m._id, emoji)}
                                align={isOwn ? "end" : "start"}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area - Mobile Optimized */}
              <div className="px-2 xs:px-2.5 sm:px-3 md:px-4 py-2 xs:py-2.5 sm:py-3 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-t border-[rgb(var(--border-secondary))] flex-shrink-0">
                {/*  ACTION ERRORS */}
                {error && (
                  <div className="mb-1.5 sm:mb-2 p-2 sm:p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-1.5 animate-in fade-in slide-in-from-top duration-200">
                    <AlertCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0" />
                    <span className="line-clamp-1">{error}</span>
                  </div>
                )}
                {sendingVideo && videoStatus && (
                  <div className="mb-1.5 sm:mb-2 p-2 sm:p-2.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-xs flex items-center gap-1.5 animate-in fade-in slide-in-from-top duration-200">
                    <Loader className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0 animate-spin" />
                    <span className="line-clamp-1">{videoStatus}</span>
                  </div>
                )}
                <div className="flex items-end gap-1 xs:gap-1.5 sm:gap-2">
                  <div className="relative hidden xs:flex gap-0.5 xs:gap-1">
                    <button
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      title="Emoji picker"
                      aria-label="Emoji picker"
                      className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0"
                    >
                      <Smile className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                    {showEmojiPicker && (
                      <EmojiPicker
                        onSelect={insertEmoji}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendingImage || sendingVideo || !selectedUserId}
                    title="Attach image or video"
                    aria-label="Attach image or video"
                    className="p-1.5 sm:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[rgb(var(--text-muted))]"
                  >
                    {sendingImage || sendingVideo ? (
                      <Loader className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 sm:w-5 h-4 sm:h-5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={handleFileSelected}
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
                      onPaste={handlePaste}
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
                    title="Send message"
                    aria-label="Send message"
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
