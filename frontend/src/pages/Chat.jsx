import React, { useEffect, useMemo, useState } from "react"
import { SOCKET_EVENTS } from "../constants/socketEvents"
import { connectSocket, disconnectSocket, getSocket } from "../socket/socketClient"
import { useNavigate } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import messageService from "../services/message.service"

export default function Chat() {
  const navigate = useNavigate()

  const [onlineUsers, setOnlineUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const token = useMemo(() => {
    return localStorage.getItem("token")
  }, [])

  const authState = useMemo(() => {
    if (!token) return { currentUserName: "", currentUserId: "" }

    try {
      const decoded = jwtDecode(token)
      return {
        currentUserName: decoded.name,
        currentUserId: decoded.userId,
      }
    } catch {
      return { currentUserName: "", currentUserId: "" }
    }
  }, [token])

  const { currentUserName, currentUserId } = authState

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
      setOnlineUsers(users || [])
    }

    // ✅ When receiving a message from someone else
    const handlePrivateMessage = (data) => {
      // ✅ Don't filter here - add message from ANY user
      console.log("📨 Received message:", data)
      
      setMessages((prev) => [
        ...prev,
        {
          _id: data._id || `temp_${Date.now()}`,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || "Unknown",
          toUserId: data.toUserId,  // ✅ Use toUserId from socket
          message: data.message,
          time: data.time || new Date().toISOString(),
        },
      ])
    }

    // ✅ Confirmation that YOUR message was sent (don't add it again!)
    const handleMessageSent = (data) => {
      console.log("💾 Message sent confirmation:", data)
      
      // ✅ Add the confirmed message to UI with real ID
      setMessages((prev) => [
        ...prev,
        {
          _id: data._id,  // ✅ Real MongoDB ID
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName,
          toUserId: data.toUserId,
          message: data.message,
          time: data.time,
        }
      ])
    }

    const handleUserOffline = ({ toUserId }) => {
      setOnlineUsers((prevUsers) => {
        const user = prevUsers.find((u) => u.userId === toUserId)
        const userName = user?.name || toUserId
        alert(`User ${userName} is offline. Message not delivered.`)
        return prevUsers
      })
    }

    const handleErrorMessage = ({ message }) => {
      alert(message || "Error")
    }

    // ✅ ADD THIS LISTENER
    const handleMessageDeleted = (data) => {
      console.log("🔔 [MESSAGE_DELETED EVENT] Received:", data)
      setMessages((prev) => {
        const before = prev.length
        const updated = prev.filter((m) => m._id !== data.messageId) 
        console.log(`🔔 Messages: before=${before}, after=${updated.length}`)
        return updated
      })
    }

    // Register socket event listeners
    socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers)
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage)
    socket.on(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent)
    socket.on(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline)
    socket.on(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage)
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted)

    // Cleanup on unmount
    return () => {
      socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers)
      socket.off(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage)
      socket.off(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent)
      socket.off(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline)
      socket.off(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage)
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted)  // ✅ Add cleanup
    }
  }, [token, navigate, currentUserId, currentUserName])

  // Fetch chat history when user is selected
  useEffect(() => {
    if (selectedUserId) {
      fetchChatHistory(selectedUserId)
      markAsRead(selectedUserId)
    }
  }, [selectedUserId])

  const fetchChatHistory = async (userId) => {
    setLoading(true)
    setError("")
    setMessages([])

    try {
      const data = await messageService.fetchChatHistory(userId)
      console.log("✅ Fetched messages:", data.messages)

      // ✅ Map backend fields to frontend fields
      const messagesWithIds = data.messages.map(msg => ({
        _id: msg._id,
        fromUserId: msg.fromUserId,  // ✅ Use senderId from backend
        toUserId: msg.toUserId,  // ✅ Use receiverId from backend
        fromUserName: msg.senderName || "Unknown",
        message: msg.message,
        time: msg.createdAt,
        read: msg.read
      }))

      setMessages(messagesWithIds)
    } catch (err) {
      console.error("Failed to fetch chat history:", err)
      setError(err.message)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (userId) => {
    try {
      await messageService.markMessagesAsRead(userId)
    } catch (err) {
      console.error("Failed to mark as read:", err)
    }
  }

  const handleDeleteMessage = async (messageId) => {
    // ✅ If it's a temporary message (not saved yet), just remove from UI
    if (messageId.toString().startsWith('temp_')) {
      console.log("🗑️ [DELETE TEMP] Removing unsent message:", messageId)
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
      return
    }

    try {
      console.log("🗑️ [DELETE] Attempting to delete:", messageId)
      
      // ✅ Delete from DB first
      await messageService.deleteMessage(messageId)
      console.log("✅ [DELETE DB] Message deleted from database")
      
      // ✅ Remove from UI
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
      
      // ✅ Notify other user via socket
      const socket = getSocket()
      if (socket) {
        console.log("📤 [DELETE SOCKET] Emitting MESSAGE_DELETED:", {
          messageId: messageId,
          toUserId: selectedUserId
        })
        socket.emit(SOCKET_EVENTS.MESSAGE_DELETED, {
          messageId: messageId,
          toUserId: selectedUserId
        })
      }
    } catch (err) {
      console.error("❌ [DELETE FAILED]:", err.message)
      setError(err.message)
    }
  }

  // ✅ FIXED: Don't add message here - let socket event handle it
  const handleSendMessage = () => {
    const socket = getSocket()
    if (!socket) {
      alert("Socket not connected")
      return
    }

    if (!selectedUserId) {
      alert("Select a user first")
      return
    }

    if (!messageInput.trim()) {
      alert("Message cannot be empty")
      return
    }

    // ✅ Send via socket WITHOUT adding to UI yet
    socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
      toUserId: selectedUserId,
      message: messageInput.trim(),
    })

    setMessageInput("")
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    disconnectSocket()
    navigate("/login")
  }

  const getDisplayName = (userId) => {
    const user = onlineUsers.find((u) => u.userId === userId)
    return user?.name || userId
  }

  return (
    <div style={{ display: "flex", height: "100vh", padding: 12, gap: 12 }}>
      {/* Left: Online Users */}
      <div
        style={{
          width: 280,
          border: "1px solid #444",
          borderRadius: 8,
          padding: 12,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Online Users</h3>
          <button onClick={handleLogout}>Logout</button>
        </div>

        {onlineUsers.length === 0 ? (
          <p>No users online</p>
        ) : (
          onlineUsers
            .filter((user) => user.userId !== currentUserId)
            .map((user) => (
              <div
                key={user.userId}
                onClick={() => setSelectedUserId(user.userId)}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border:
                    selectedUserId === user.userId
                      ? "2px solid #00ff99"
                      : "1px solid #666",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: "bold" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedUserId === user.userId ? "Selected" : "Click to chat"}
                </div>
              </div>
            ))
       )}
      </div>

      {/* Right: Chat Area */}
      <div
        style={{
          flex: 1,
          border: "1px solid #444",
          borderRadius: 8,
          padding: 12,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Chat With:{" "}
          <span style={{ opacity: 0.8 }}>
            {selectedUserId ? getDisplayName(selectedUserId) : "No user selected"}
          </span>
        </h3>

        {loading && <p style={{ color: "#00ff99" }}>Loading messages...</p>}
        {error && <p style={{ color: "#ff0000" }}>Error: {error}</p>}

        {/* Messages */}
        <div
          style={{
            flex: 1,
            border: "1px solid #666",
            borderRadius: 8,
            padding: 12,
            overflowY: "auto",
            marginBottom: 12,
          }}
        >
          {messages.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No messages yet</p>
          ) : (
            messages
              .filter((m) => {
                if (!selectedUserId) return true
                // Show messages between currentUser and selectedUser
                return (
                  (m.fromUserId === currentUserId && m.toUserId === selectedUserId) ||
                  (m.fromUserId === selectedUserId && m.toUserId === currentUserId)
                )
              })
              .map((m, index) => (
                <div
                  key={m._id || index}
                  style={{
                    marginBottom: 10,
                    textAlign: m.fromUserId === currentUserId ? "right" : "left",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {m.fromUserId === currentUserId ? currentUserName : m.fromUserName}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #777",
                      maxWidth: "70%",
                      wordBreak: "break-word",
                      position: "relative",
                    }}
                  >
                    {m.message}
                    {m.fromUserId === currentUserId && (
                      <button
                        onClick={() => handleDeleteMessage(m._id)}
                        style={{
                          marginLeft: "8px",
                          fontSize: "10px",
                          padding: "2px 4px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type message..."
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #666",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage()
            }}
          />
          <button onClick={handleSendMessage} style={{ padding: "10px 14px" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
