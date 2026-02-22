import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { SOCKET_EVENTS } from "@constants/socketEvents.js"
import { connectSocket, disconnectSocket, getSocket, isSocketConnected, waitForSocket } from "@socket/socketClient.js"
import { useNavigate } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import messageService from "@services/message.service.js"
import axios from "axios"
import { 
  MessageCircle, 
  Send, 
  Trash2, 
  LogOut, 
  Users, 
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  Circle,
  Settings,
  Volume2,
  VolumeX,
  Paperclip,
  Smile,
  X,
  Pin,
  Bell,
  BellOff
} from "lucide-react"

export default function Chat() {
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)
  const messageInputRef = useRef(null)
  const fileInputRef = useRef(null)

  // States
  const [allUsers, setAllUsers] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [typingUsers, setTypingUsers] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [pinnedChats, setPinnedChats] = useState([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const typingTimeoutRef = useRef(null)
  const lastTypingTimeRef = useRef(0)

  const token = localStorage.getItem("token")

  let authState = { currentUserName: "", currentUserId: "" }

  if (token) {
    try {
      const decoded = jwtDecode(token)
      authState = {
        currentUserName: decoded.name,
        currentUserId: decoded.userId,
      }
    } catch {
      authState = { currentUserName: "", currentUserId: "" }
    }
  }

  const { currentUserName, currentUserId } = authState

  // Fetch all users from backend
  const fetchAllUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await axios.get("/users", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      if (response.data.success) {
        const users = response.data.data || []
        console.log("✅ [FETCH] Got", users.length, "users from API")
        setAllUsers(users.map(u => ({
          userId: u._id || u.userId,
          name: u.name,
          email: u.email,
          online: false,  // Start as offline, socket will update
          lastSeen: u.lastSeen,
          createdAt: u.createdAt
        })))
      }
    } catch (err) {
      console.error("❌ Failed to fetch all users:", err)
    }
  }, [])



  // Fetch all users on component mount
  useEffect(() => {
    fetchAllUsers()
  }, [fetchAllUsers])

  // Notification sound
  const playNotificationSound = () => {
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKnn77BXGwU7k9n1xnMpBSh+zPLaizsKGGS56+mnUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJGGS56+inTxILTKXh8bllHAU1jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJGGS56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBQ==')
      audio.volume = 0.3
      audio.play().catch(() => {})
    }
  }

  // Browser notification
  const showNotification = (title, message) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: '/logo.png',
        badge: '/logo.png'
      })
    }
  }

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive - use requestAnimationFrame for smooth performance
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      })
    }
  }, [messages])

  // Socket connection effect
  useEffect(() => {
    if (!token) {
      navigate("/login")
      return
    }

    let socket = connectSocket(token)

    if (!socket) {
      return
    }

    const handleOnlineUsers = (users) => {
      console.log("📡 [ONLINE_USERS] Received:", users?.length, "users")
      console.log("📡 [ONLINE_USERS] Sample user structure:", users?.[0])
      
      setOnlineUsers(users || [])
      
      // Update allUsers with online status from socket - real-time sync
      if (users && users.length > 0) {
        setAllUsers((prevUsers) => {
          if (prevUsers.length === 0) {
            console.log("⚠️ [SYNC] allUsers is empty, creating from online users")
            return users.map(u => ({
              userId: u.userId || u._id,
              name: u.name,
              email: u.email || "",
              online: u.online || true,
              lastSeen: u.lastSeen,
              createdAt: u.createdAt
            }))
          }
          
          const updated = prevUsers.map((u) => {
            const onlineUser = users.find(ou => (ou.userId === u.userId) || (ou._id === u.userId))
            if (onlineUser) {
              if (u.online !== onlineUser.online) {
                console.log(`🔄 [SYNC] User ${u.name}: ${u.online} → ${onlineUser.online}`)
                return { ...u, online: onlineUser.online || true }
              }
            }
            return u
          })
          
          // Check if anything changed
          const hasChanges = updated.some((u, i) => u.online !== prevUsers[i].online)
          if (hasChanges) {
            console.log("🔄 Synced allUsers with onlineUsers - changes detected")
          }
          return hasChanges ? updated : prevUsers
        })
      }
    }

    const handlePrivateMessage = (data) => {
      // Validate message data
      if (!data._id || !data.fromUserId || !data.message) {
        console.error("❌ Invalid message data:", data)
        return
      }

      console.log("📨 [MSG] Received from", data.fromUserId)

      const isInCurrentChat = data.fromUserId === selectedUserId

      // Prevent duplicate messages
      setMessages((prev) => {
        const messageExists = prev.some(m => m._id === data._id)
        if (messageExists) return prev

        const existsByUniqueId = prev.some(m => m.uniqueId === data.uniqueId && data.uniqueId)
        if (existsByUniqueId) return prev

        const newMessage = {
          _id: data._id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || "Unknown",
          toUserId: data.toUserId || currentUserId,
          message: data.message,
          time: data.time || data.createdAt || new Date().toISOString(),
          read: isInCurrentChat,  // Mark as read instantly if in current chat
          delivered: data.delivered || true,
          uniqueId: data.uniqueId
        }

        console.log(`📨 [MSG] ${isInCurrentChat ? '✅ Read' : '📌 Unread'}`)
        return [...prev, newMessage]
      })

      // If message is in current chat, send read receipt immediately
      if (isInCurrentChat) {
        // Send read receipt with small delay to ensure socket is ready
        setTimeout(() => {
          const socket = getSocket()
          if (socket?.connected) {
            socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
              messageId: data._id,
              senderId: data.fromUserId,
              receiverId: currentUserId
            })
            console.log("📤 [READ_RECEIPT] Sent for:", data._id)
          }
        }, 50)
      } else {
        // Increment unread count if from different user
        setUnreadCounts(prev => ({
          ...prev,
          [data.fromUserId]: (prev[data.fromUserId] || 0) + 1
        }))

        // Play notification sound and show notification
        playNotificationSound()
        showNotification(data.fromUserName || "New Message", data.message)
      }
    }

    const handleMessageSent = (data) => {
      // Replace optimistic message with server response using UNIQUE ID (most reliable)
      setMessages((prev) => {
        // Strategy 1: Match by uniqueId (most reliable for rapid sends)
        let tempIndex = prev.findIndex(m => m.uniqueId === data.uniqueId)

        if (tempIndex !== -1) {
          const updated = [...prev]
          updated[tempIndex] = {
            _id: data._id || data.messageId,
            fromUserId: data.fromUserId || currentUserId,
            fromUserName: data.fromUserName || currentUserName,
            toUserId: data.toUserId,
            message: data.message,
            time: data.time || data.createdAt || new Date().toISOString(),
            read: false,
            sending: false,
            delivered: true,
            uniqueId: undefined
          }
          console.log("✅ [MESSAGE_SENT] Updated message with uniqueId:", data.uniqueId)
          return updated
        }

        // Strategy 2: Match by tempId if uniqueId not found (fallback)
        tempIndex = prev.findIndex(m => m._id === data.tempId)
        if (tempIndex !== -1) {
          const updated = [...prev]
          updated[tempIndex] = {
            _id: data._id || data.messageId,
            fromUserId: data.fromUserId || currentUserId,
            fromUserName: data.fromUserName || currentUserName,
            toUserId: data.toUserId,
            message: data.message,
            time: data.time || data.createdAt || new Date().toISOString(),
            read: false,
            sending: false,
            delivered: true
          }
          console.log("✅ [MESSAGE_SENT] Updated message with tempId:", data.tempId)
          return updated
        }

        console.warn("⚠️ [MESSAGE_SENT] Could not find message to update. Received data:", data)
        return prev
      })
    }

    const handleMessageRead = (data) => {
      // Update message read status to show blue tick instantly
      console.log("🔵 [MESSAGE_READ] Event received with data:", JSON.stringify(data))
      
      if (!data.messageId) {
        console.warn("⚠️ [MESSAGE_READ] No messageId in data:", data)
        return
      }

      setMessages((prev) => {
        const updated = prev.map(m => {
          if (m._id === data.messageId && !m.read) {
            console.log("🔵 [MESSAGE_READ] ✅ Updated message:", m._id, "from read:", m.read, "to read: true")
            return { ...m, read: true }
          }
          return m
        })
        
        // Debug: log what was actually updated
        const foundMessage = updated.find(m => m._id === data.messageId)
        if (foundMessage) {
          console.log("🔵 [MESSAGE_READ] Result - Message read status:", foundMessage.read)
        } else {
          console.warn("❌ [MESSAGE_READ] Message not found in state:", data.messageId)
          console.warn("📋 [MESSAGE_READ] Available message IDs:", prev.map(m => m._id))
        }
        
        return updated
      })
    }

    const handleUserOffline = ({ toUserId }) => {
      console.log("👤 [USER_OFFLINE] User:", toUserId)
      
      // Update onlineUsers - remove offline user
      setOnlineUsers((prevUsers) => {
        const updatedUsers = prevUsers.filter((u) => u.userId !== toUserId)
        return updatedUsers.length !== prevUsers.length ? updatedUsers : prevUsers
      })
      
      // Update allUsers - mark specific user as offline (real-time)
      setAllUsers((prevUsers) => {
        const userIndex = prevUsers.findIndex((u) => u.userId === toUserId)
        if (userIndex !== -1 && prevUsers[userIndex].online) {
          const updated = [...prevUsers]
          updated[userIndex] = { ...updated[userIndex], online: false }
          console.log("🔄 Marked user offline in allUsers:", toUserId)
          return updated
        }
        return prevUsers
      })
    }

    const handleErrorMessage = ({ message }) => {
      setError(message || "Error occurred")
      setTimeout(() => setError(""), 3000)
    }

    const handleMessageDeleted = (data) => {
      setMessages((prev) => prev.filter((m) => m._id !== data.messageId))
    }

    const handleTyping = ({ fromUserId, isTyping }) => {
      setTypingUsers(prev => ({
        ...prev,
        [fromUserId]: isTyping
      }))
    }

    // Register socket event listeners
    socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers)
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage)
    socket.on(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent)
    socket.on(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline)
    socket.on(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage)
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted)
    socket.on(SOCKET_EVENTS.TYPING, handleTyping)
    socket.on(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead)

    // Cleanup on unmount
    return () => {
      socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers)
      socket.off(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage)
      socket.off(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent)
      socket.off(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline)
      socket.off(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage)
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted)
      socket.off(SOCKET_EVENTS.TYPING, handleTyping)
      socket.off(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [token, navigate, currentUserId, currentUserName, selectedUserId])

  // Fetch chat history when user is selected
  useEffect(() => {
    if (selectedUserId) {
      fetchChatHistory(selectedUserId)
      // Clear unread count for selected user
      setUnreadCounts(prev => ({
        ...prev,
        [selectedUserId]: 0
      }))
      // Focus on input
      messageInputRef.current?.focus()
      
      // Polling: Check for updated read status every 500ms for instant blue ticks
      const pollInterval = setInterval(() => {
        updateMessageReadStatus(selectedUserId)
      }, 20)
      
      return () => clearInterval(pollInterval)
    }
  }, [selectedUserId, currentUserId])

  // In the fetchChatHistory function, update it to properly mark messages as read:
  const fetchChatHistory = async (userId) => {
    setLoading(true)
    setError("")
    setMessages([])

    try {
      const data = await messageService.fetchChatHistory(userId)
      console.log("✅ [CHAT_HISTORY] Fetched messages:", data.messages.length)

      // Map backend fields to frontend fields
      const messagesWithIds = data.messages.map(msg => ({
        _id: msg._id,
        fromUserId: msg.fromUserId,
        toUserId: msg.toUserId,
        fromUserName: msg.senderName || "Unknown",
        message: msg.message,
        time: msg.createdAt,
        read: msg.read
      }))

      setMessages(messagesWithIds)

      // Get unread messages from the other user
      const unreadMessages = messagesWithIds.filter(
        msg => msg.fromUserId === userId && !msg.read
      )

      if (unreadMessages.length > 0) {
        console.log(`📖 [READ_STATUS] Found ${unreadMessages.length} unread messages`)

        // Step 1: Immediately mark all unread messages as read in UI (optimistic update)
        setMessages((prev) =>
          prev.map((m) => {
            if (m.fromUserId === userId && !m.read) {
              return { ...m, read: true }
            }
            return m
          })
        )

        // Step 2: Send read receipts via socket
        const socket = getSocket()
        if (socket && socket.connected) {
          unreadMessages.forEach((msg) => {
            socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
              messageId: msg._id,
              senderId: msg.fromUserId,
              receiverId: currentUserId
            })
          })
          console.log(`📤 [READ_RECEIPT] Sent ${unreadMessages.length} read receipts`)
        }

        // Step 3: Persist to database
        try {
          await messageService.markMessagesAsRead(userId)
          console.log(`✅ [DATABASE] Marked ${unreadMessages.length} messages as read`)
        } catch (apiErr) {
          console.error("❌ [DATABASE] Failed to persist read status:", apiErr)
        }
      }
    } catch (err) {
      console.error("❌ [CHAT_HISTORY] Failed to fetch:", err)
      setError(err.message)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  // Backup mechanism: Poll for updated read status
  const updateMessageReadStatus = async (userId) => {
    try {
      const data = await messageService.fetchChatHistory(userId)
      
      // Check if any sent messages have been marked as read
      setMessages((prev) => {
        let hasChanges = false
        
        const updated = prev.map((m) => {
          // Only check sent messages from current user
          if (m.fromUserId === currentUserId && !m.read) {
            // Find the updated message from backend
            const updatedMsg = data.messages.find(msg => msg._id === m._id)
            
            // If message is marked as read in DB but not in UI
            if (updatedMsg && updatedMsg.read) {
              console.log("🔵 [INSTANT_READ] Blue tick appeared for:", m._id)
              hasChanges = true
              return { ...m, read: true }
            }
          }
          return m
        })
        
        return hasChanges ? updated : prev
      })
    } catch (err) {
      // Silently fail - this is just a backup mechanism
      console.debug("[POLL] Read status update failed")
    }
  }

  const markAsRead = useCallback(async (userId) => {
    try {
      await messageService.markMessagesAsRead(userId)
    } catch (err) {
      console.error("Failed to mark as read:", err)
    }
  }, [])

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (messageId.toString().startsWith('temp_')) {
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
      return
    }

    try {
      await messageService.deleteMessage(messageId)

      setMessages((prev) => prev.filter((m) => m._id !== messageId))

      const socket = getSocket()
      if (socket) {
        socket.emit(SOCKET_EVENTS.MESSAGE_DELETED, {
          messageId: messageId,
          toUserId: selectedUserId
        })
      }
    } catch (err) {
      console.error("❌ [DELETE FAILED]:", err.message)
      setError(err.message)
      setTimeout(() => setError(""), 3000)
    }
  }, [selectedUserId])

  const handleRetryMessage = useCallback((failedMessage) => {
    // Remove the failed message
    setMessages((prev) => prev.filter((m) => m._id !== failedMessage._id))
    // Set input to the failed message text and send again
    setMessageInput(failedMessage.message)
  }, [])

  const handleSendMessage = useCallback(() => {
    const socket = getSocket()
    if (!socket) {
      console.error("❌ Socket not initialized")
      setError("Connection error. Please refresh the page.")
      setTimeout(() => setError(""), 5000)
      return
    }

    if (!isSocketConnected()) {
      console.warn("⚠️ Socket not connected, waiting for connection...")
      
      // Wait for socket to connect, then send (silently, no error message)
      waitForSocket()
        .then(() => {
          // Recursively call after socket is ready
          handleSendMessage()
        })
        .catch((err) => {
          console.error("❌ Socket connection failed:", err)
          setError("Connection failed. Please check your internet.")
          setTimeout(() => setError(""), 5000)
        })
      return
    }

    if (!selectedUserId) {
      console.error("❌ No user selected")
      setError("Select a user first")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!messageInput.trim()) {
      return
    }

    if (!currentUserId || !currentUserName) {
      console.error("❌ User not authenticated")
      setError("User authentication failed")
      setTimeout(() => setError(""), 3000)
      return
    }

    const messageText = messageInput.trim()
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const tempId = `temp_${uniqueId}`

    // Optimistically add message to UI immediately
    const optimisticMessage = {
      _id: tempId,
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      toUserId: selectedUserId,
      message: messageText,
      time: new Date().toISOString(),
      read: false,
      sending: true,
      delivered: false,
      uniqueId: uniqueId
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setMessageInput("")
    setReplyingTo(null)

    socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
      toUserId: selectedUserId,
      message: messageText,
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      tempId: tempId,
      uniqueId: uniqueId
    }, (error, response) => {
      console.log("📨 [CALLBACK] Message callback received. Error:", error, "Response:", response)
      
      if (error) {
        console.error("❌ Message send error:", error)
        // Mark message as failed
        setMessages((prev) => 
          prev.map(m => 
            m._id === tempId ? { ...m, sending: false, delivered: false, error: true } : m
          )
        )
        return
      }

      if (!response || response.success === false) {
        console.error("❌ Server rejected message:", response?.message)
        setMessages((prev) => 
          prev.map(m => 
            m._id === tempId ? { ...m, sending: false, delivered: false, error: true } : m
          )
        )
        return
      }

      // Message sent successfully - update with real ID
      console.log("✅ Message sent successfully. Response:", response)
      setMessages((prev) => 
        prev.map(m => {
          if (m._id === tempId) {
            return {
              ...m,
              _id: response._id,
              sending: false,
              delivered: response.delivered,
              uniqueId: undefined
            }
          }
          return m
        })
      )
    })
  }, [selectedUserId, messageInput, currentUserId, currentUserName])

  const handleTyping = useCallback((isTyping) => {
    const socket = getSocket()
    if (!socket || !selectedUserId) return

    const now = Date.now()
    const timeSinceLastTyping = now - lastTypingTimeRef.current

    // Only emit typing event every 300ms max
    if (timeSinceLastTyping < 300 && isTyping) return

    lastTypingTimeRef.current = now

    if (isTyping) {
      socket.emit(SOCKET_EVENTS.TYPING, {
        toUserId: selectedUserId,
        isTyping: true
      })

      // Auto stop typing after 2 seconds
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit(SOCKET_EVENTS.TYPING, {
          toUserId: selectedUserId,
          isTyping: false
        })
      }, 2000)
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      socket.emit(SOCKET_EVENTS.TYPING, {
        toUserId: selectedUserId,
        isTyping: false
      })
    }
  }, [selectedUserId])

  const handleLogout = () => {
    localStorage.removeItem("token")
    disconnectSocket()
    navigate("/login")
  }

  const togglePinChat = useCallback((userId) => {
    setPinnedChats(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }, [])

  const getDisplayName = useCallback((userId) => {
    const user = onlineUsers.find((u) => u.userId === userId)
    return user?.name || userId
  }, [onlineUsers])

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const filteredUsers = useMemo(() => {
    // Use allUsers if available, otherwise fallback to onlineUsers
    const usersToFilter = allUsers.length > 0 ? allUsers : onlineUsers
    
    return usersToFilter
      .filter((user) => user.userId !== currentUserId)
      .filter((user) => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Pin sorting
        const aIsPinned = pinnedChats.includes(a.userId)
        const bIsPinned = pinnedChats.includes(b.userId)
        if (aIsPinned && !bIsPinned) return -1
        if (!aIsPinned && bIsPinned) return 1
        
        // Online status sorting (online users first)
        if (a.online && !b.online) return -1
        if (!a.online && b.online) return 1
        
        // Unread sorting
        const aUnread = unreadCounts[a.userId] || 0
        const bUnread = unreadCounts[b.userId] || 0
        return bUnread - aUnread
      })
  }, [allUsers, onlineUsers, currentUserId, searchQuery, pinnedChats, unreadCounts])

  const currentChatMessages = useMemo(() => {
    return messages.filter((m) => {
      if (!selectedUserId) return false
      return (
        (m.fromUserId === currentUserId && m.toUserId === selectedUserId) ||
        (m.fromUserId === selectedUserId && m.toUserId === currentUserId)
      )
    })
  }, [messages, selectedUserId, currentUserId])

  const commonEmojis = ['😊', '👍', '❤️', '😂', '🎉', '🔥', '✅', '👏', '🙏', '💯']

  return (
    <div className="flex h-screen bg-[rgb(var(--bg-primary))]">
      {/* Sidebar - Users List */}
      <div className="w-80 glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col">
        {/* Header */}
          <div className="p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-amber-100 font-bold glow-green">
              {currentUserName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[rgb(var(--bg-secondary))] rounded-full pulse-glow"></div>
                </div>
                <div className="flex-1 min-w-0">
            <h2 className="text-gray-500 font-normal truncate" title={currentUserName}>
              {currentUserName.length > 20 ? `${currentUserName.substring(0, 20)}...` : currentUserName}
            </h2>
            <p className="text-xs text-green-400 flex items-center gap-1 font-medium">
              <Circle className="w-2 h-2 fill-current animate-pulse" />
              Active Now
            </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400"
            title="Settings"
                >
            <Settings className="w-5 h-5" />
                </button>
                <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
            title="Logout"
            aria-label="Logout"
                >
            <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
          {showSettings && (
            <div className="mb-4 p-3 glass-effect rounded-lg space-y-2 animate-in slide-in-from-top">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  Sound
                </span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-10 h-6 rounded-full transition-all ${
                    soundEnabled ? 'bg-green-500' : 'bg-gray-600'
                  } relative`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                    soundEnabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  Notifications
                </span>
                <button
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-10 h-6 rounded-full transition-all ${
                    notificationsEnabled ? 'bg-green-500' : 'bg-gray-600'
                  } relative`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                    notificationsEnabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative border border-b-black border-[rgb(var(--border-secondary))] rounded-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-3 px-4 items-center">
            <button className="flex-1 px-4 py-2 bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-lg font-medium text-sm transition-all hover:from-green-500 hover:to-emerald-600 shadow-md glow-green">
              Chat
            </button>
            <button
              onClick={() => navigate("/groupchat")}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-all shadow-md"
              title="Go to Group Chat"
            >
              Groups
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Conversations ({filteredUsers.length})
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active conversations</p>
              <p className="text-xs text-gray-600 mt-1">Start chatting with someone!</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isPinned = pinnedChats.includes(user.userId)
              const unreadCount = unreadCounts[user.userId] || 0
              
              return (
                <div
                  key={user.userId}
                  className={`group relative p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all ${
                    selectedUserId === user.userId
                      ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                      : "hover:bg-[rgb(var(--bg-hover))]/50"
                  }`}
                >
                  <div onClick={() => setSelectedUserId(user.userId)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-black font-bold text-lg shadow-lg ${
                            user.online 
                              ? 'bg-linear-to-br from-green-500 to-teal-600' 
                              : 'bg-linear-to-br from-gray-500 to-gray-600'
                          }`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[rgb(var(--bg-secondary))] rounded-full ${
                            user.online 
                              ? 'bg-green-400 pulse-glow' 
                              : 'bg-gray-400'
                          }`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-black truncate max-w-xs" title={user.name}>{user.name}</div>
                            {isPinned && <Pin className="w-3 h-3 text-green-400 shrink-0" />}
                          </div>
                          <div className={`text-xs ${selectedUserId === user.userId ? (user.online ? 'text-green-300' : 'text-gray-400') : (user.online ? 'text-green-500' : 'text-gray-500')}`}>
                            {typingUsers[user.userId] ? (
                              <span className="text-green-400 flex items-center gap-1">
                                Typing
                                <span className="flex gap-0.5">
                                  <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                                  <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                                  <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                                </span>
                              </span>
                            ) : user.online ? (
                              <span className="flex items-center gap-1">
                                <Circle className="w-1.5 h-1.5 fill-green-500" />
                                Online
                              </span>
                            ) : (
                              <span className="text-gray-500">Offline</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <div className="w-6 h-6 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-black shadow-lg glow-green">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Pin button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePinChat(user.userId)
                    }}
                    className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                      isPinned ? 'text-green-400 bg-green-500/20' : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))] hover:text-green-400'
                    }`}
                    title={isPinned ? "Unpin" : "Pin"}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[rgb(var(--bg-primary))]">
        {selectedUserId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-black font-bold shadow-lg glow-green">
                    {getDisplayName(selectedUserId).charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[rgb(var(--bg-primary))] rounded-full pulse-glow"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-black text-lg">{getDisplayName(selectedUserId)}</h3>
                  <p className="text-xs text-gray-400">
                    {typingUsers[selectedUserId] ? (
                      <span className="text-green-400 font-medium flex items-center gap-1">
                        Typing
                        <span className="flex gap-0.5">
                          <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                          <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                          <span className="typing-dot w-1 h-1 bg-green-400 rounded-full"></span>
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-current text-green-400 animate-pulse" />
                        Active Now
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-linear-to-b from-[rgb(var(--bg-primary))] to-[rgb(var(--bg-secondary))]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                    <p className="text-sm text-gray-500">Loading messages...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 shadow-lg">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                  <p className="font-medium">{error}</p>
                </div>
              ) : currentChatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="w-24 h-24 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-lg">
                    <MessageCircle className="w-12 h-12 text-green-500/50" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 gradient-text">Start a Conversation</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Send a message to {getDisplayName(selectedUserId)} and start chatting!
                  </p>
                </div>
              ) : (
                currentChatMessages.map((m, index) => {
                  const isOwn = m.fromUserId === currentUserId
                  const showAvatar = index === 0 || currentChatMessages[index - 1].fromUserId !== m.fromUserId

                  return (
                    <div
                      key={m._id || index}
                      className={`flex gap-3 ${isOwn ? "flex-row-reverse message-right" : "flex-row message-left"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      {showAvatar ? (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                          isOwn 
                            ? "bg-linear-to-br from-blue-500 to-purple-600" 
                            : "bg-linear-to-br from-green-500 to-teal-600 glow-green"
                        }`}>
                          {(isOwn ? currentUserName : m.fromUserName).charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8"></div>
                      )}

                      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
                        {showAvatar && !isOwn && (
                          <span className="text-xs text-gray-400 mb-1 ml-2 font-medium">{m.fromUserName}</span>
                        )}
                        
                        <div className={`relative group/message ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-sm transition-all ${
                              m.error
                                ? "bg-red-600/20 border border-red-500/50 text-red-300"
                                : isOwn
                                ? "bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm"
                                : "glass-effect text-white rounded-tl-sm border border-[rgb(var(--border-secondary))]"
                            }`}
                          >
                            <p className="wrap-break-word leading-relaxed">{m.message}</p>
                          </div>

                          <div className={`flex items-center gap-2 mt-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                            <span className="text-xs text-gray-500 font-medium">{formatTime(m.time)}</span>
                            {isOwn && (
                              <>
                                {m.error ? (
                                  <button
                                    onClick={() => handleRetryMessage(m)}
                                    className="text-xs text-red-400 font-semibold hover:text-red-300 hover:underline"
                                    title="Retry sending"
                                  >
                                    Retry ✗
                                  </button>
                                ) : m.sending ? (
                                  <span className="text-xs text-yellow-400 font-semibold" title="Sending...">⏳</span>
                                ) : m.read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-400" title="Read" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-gray-400" title="Sent" />
                                )}
                                <button
                                  onClick={() => handleDeleteMessage(m._id)}
                                  className="opacity-0 group-hover/message:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 glass-effect border-t border-[rgb(var(--border-secondary))]">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-3 p-3 bg-[rgb(var(--bg-tertiary))]/50 border-l-2 border-green-500 rounded-lg flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-400 font-semibold mb-1">Replying to</p>
                    <p className="text-sm text-gray-300 truncate">{replyingTo.message}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-[rgb(var(--bg-hover))] rounded transition-all text-gray-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="mb-3 p-3 glass-effect rounded-lg border border-[rgb(var(--border-secondary))]">
                  <div className="grid grid-cols-10 gap-2">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setMessageInput(prev => prev + emoji)
                          setShowEmojiPicker(false)
                        }}
                        className="text-2xl hover:bg-[rgb(var(--bg-hover))] p-2 rounded-lg transition-all hover:scale-110"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-3">
                {/* Additional Actions */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400"
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-gray-400 hover:text-green-400"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                {/* Message Input */}
                <div className="flex-1 glass-effect rounded-2xl border border-[rgb(var(--border-secondary))] focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value)
                      handleTyping(e.target.value.length > 0)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                        handleTyping(false)
                      }
                    }}
                    onBlur={() => handleTyping(false)}
                    placeholder="Type your message..."
                    rows="1"
                    className="w-full px-4 py-3 bg-transparent text-black placeholder-gray-500 resize-none focus:outline-none max-h-32 custom-scrollbar"
                    style={{ minHeight: "48px" }}
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={() => {
                    handleSendMessage()
                    handleTyping(false)
                  }}
                  disabled={!messageInput.trim()}
                  className={`p-3 rounded-xl transition-all shadow-lg ${
                    messageInput.trim()
                      ? "bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-black glow-green"
                      : "bg-[rgb(var(--bg-tertiary))] text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1 font-mono">
                Press <kbd className="px-1.5 py-0.5 bg-[rgb(var(--bg-tertiary))] rounded text-gray-400 font-semibold">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-[rgb(var(--bg-tertiary))] rounded text-gray-400 font-semibold">Shift + Enter</kbd> for new line
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="w-32 h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-2xl">
              <MessageCircle className="w-16 h-16 text-green-500/50" />
            </div>
            <h3 className="text-3xl font-bold mb-3 gradient-text">Welcome to Pandav Chat</h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Select a conversation from the sidebar to start messaging
            </p>
            <div className="flex gap-3">
              <div className="px-4 py-2 glass-effect rounded-lg text-sm text-gray-400">
                ⚡ Real-time messaging
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}