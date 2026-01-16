import React, { useEffect, useMemo, useState } from "react";
import { SOCKET_EVENTS } from "../constants/socketEvents";
import { connectSocket, disconnectSocket, getSocket } from "../socket/socketClient";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function Chat() {
  const navigate = useNavigate();

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);

  const token = useMemo(() => {
    return localStorage.getItem("token");
  }, []);

  const authState = useMemo(() => {
    if (!token) return { currentUserName: "", currentUserId: "" };

    try {
      const decoded = jwtDecode(token);
      return {
        currentUserName: decoded.name,
        currentUserId: decoded.userId,
      };
    } catch {
      // ✅ Removed unused 'error' parameter
      return { currentUserName: "", currentUserId: "" };
    }
  }, [token]);

  const { currentUserName, currentUserId } = authState;

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    let socket = connectSocket(token);

    if (!socket) {
      return;
    }

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users || []);
    };

    const handlePrivateMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName,
          toUserId: "me",
          message: data.message,
          time: data.time,
        },
      ]);
    };

    const handleMessageSent = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          fromUserId: currentUserId,
          fromUserName: currentUserName,
          toUserId: data.toUserId,
          toUserName: data.toUserName,
          message: data.message,
          time: data.time,
        },
      ]);
    };

    // ✅ FIXED: Use callback pattern to avoid dependency on onlineUsers
    const handleUserOffline = ({ toUserId }) => {
      // Get latest onlineUsers from state when needed
      setOnlineUsers((prevUsers) => {
        const user = prevUsers.find(u => u.userId === toUserId);
        const userName = user?.name || toUserId;
        alert(`User ${userName} is offline. Message not delivered.`);
        return prevUsers; // Return unchanged
      });
    };

    const handleErrorMessage = ({ message }) => {
      alert(message || "Error");
    };

    socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
    socket.on(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
    socket.on(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
    socket.on(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage);

    return () => {
      socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
      socket.off(SOCKET_EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
      socket.off(SOCKET_EVENTS.MESSAGE_SENT, handleMessageSent);
      socket.off(SOCKET_EVENTS.USER_OFFLINE, handleUserOffline);
      socket.off(SOCKET_EVENTS.ERROR_MESSAGE, handleErrorMessage);
    };
  }, [token, navigate, currentUserId, currentUserName]);

  const handleSendMessage = () => {
    const socket = getSocket();
    if (!socket) {
      alert("Socket not connected");
      return;
    }

    if (!selectedUserId) {
      alert("Select a user first");
      return;
    }

    if (!messageInput.trim()) {
      alert("Message cannot be empty");
      return;
    }

    socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
      toUserId: selectedUserId,
      message: messageInput.trim(),
    });

    setMessageInput("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    navigate("/login");
  };

  const getDisplayName = (userId) => {
    const user = onlineUsers.find(u => u.userId === userId);
    return user?.name || userId;
  };

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
            .filter(user => user.userId !== currentUserId)
            .map((user) => (
              <div
                key={user.userId}
                onClick={() => setSelectedUserId(user.userId)}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border: selectedUserId === user.userId ? "2px solid #00ff99" : "1px solid #666",
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
                if (!selectedUserId) return true;
                return m.fromUserId === selectedUserId || m.toUserId === selectedUserId;
              })
              .map((m, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 10,
                    textAlign: m.fromUserId === "me" ? "right" : "left",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {m.fromUserId === "me" ? currentUserName : m.fromUserName}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #777",
                      maxWidth: "70%",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.message}
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
              if (e.key === "Enter") handleSendMessage();
            }}
          />
          <button onClick={handleSendMessage} style={{ padding: "10px 14px" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
