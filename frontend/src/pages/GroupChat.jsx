import React, { useState, useEffect, useCallback, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import groupService from "@services/group.service";
import messageService from "@services/message.service";
import axios from "axios";
import { SOCKET_EVENTS } from "@constants/socketEvents.js";
import { getSocket } from "@socket/socketClient.js";
import {
  Users,
  Search,
  Plus,
  Trash2,
  X,
  ChevronDown,
  Check,
  CheckCheck,
  Pin,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Menu,
  ChevronLeft,
  MessageCircle,
  Loader,
} from "lucide-react";

export default function GroupChat({
  sidebarOpen,
  setSidebarOpen,
  bgImage,
  bgImages,
  token,
  currentUserName,
  currentUserId,
}) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembersPreview, setShowMembersPreview] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedGroups, setPinnedGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messageInputRef = React.useRef(null);
  const messagesEndRef = React.useRef(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [searchUsers, setSearchUsers] = useState("");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [removeMemberLoading, setRemoveMemberLoading] = useState(null);
  const [usersToAddList, setUsersToAddList] = useState([]);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);
  const [searchUsersToAdd, setSearchUsersToAdd] = useState(""); // NEW: Separate search state
  const [messageReadStatus, setMessageReadStatus] = useState({}); // Track who read each message
  const [lastMessages, setLastMessages] = useState({}); // Track last message per group
  const [onlineMembers, setOnlineMembers] = useState({}); // Track online members per group

  // Fetch all groups
  const fetchAllGroups = useCallback(async () => {
    try {
      const response = await axios.get("/groups", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.data.success) {
        const groupList = response.data.data || [];
        setGroups(
          groupList.map((g) => ({
            groupId: g._id || g.groupId,
            id: g._id || g.groupId,
            name: g.name,
            description: g.description,
            membersCount: g.members?.length || 0,
            createdAt: g.createdAt,
          }))
        );
      }
    } catch (err) {
      console.error("❌ Failed to fetch groups:", err);
      setError("Failed to load groups");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchAllGroups();
  }, [token, fetchAllGroups]);

  // Fetch available users for adding to groups
  const fetchAvailableUsers = useCallback(async () => {
    try {
      const response = await axios.get("/users", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.data.success) {
        setAvailableUsers(response.data.data || []);
      }
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  }, [token]);

  useEffect(() => {
    if (showCreateGroupModal && availableUsers.length === 0) {
      fetchAvailableUsers();
    }
  }, [showCreateGroupModal, availableUsers, fetchAvailableUsers]);

  // Fetch group messages when selected
  useEffect(() => {
    if (!selectedGroup) return;

    const fetchGroupMessages = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `/groups/${selectedGroup.id}/messages`,
          {
            baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          const msgs = response.data.data || [];
          setMessages(
            msgs.map((msg) => ({
              _id: msg._id,
              fromUserId: msg.senderId?._id || msg.fromUserId || msg.userId,
              fromUserName: msg.senderId?.name || msg.fromUserName || msg.userName,
              message: msg.message,
              time: msg.createdAt,
              read: msg.read || true,
            }))
          );
        }
      } catch (err) {
        console.error("❌ Failed to fetch group messages:", err);
        setError("Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupMessages();
    setUnreadCounts((prev) => ({
      ...prev,
      [selectedGroup.id]: 0,
    }));
    messageInputRef.current?.focus();
  }, [selectedGroup, token]);

  // Fetch group members
  useEffect(() => {
    if (!selectedGroup) return;

    const fetchMembers = async () => {
      try {
        // Get the full group data which includes members
        const response = await axios.get(
          `/groups/${selectedGroup.id}`,
          {
            baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          // Extract members from group response
          const membersList = response.data.data.members || 
                             response.data.data.participants || 
                             [];
          setMembers(Array.isArray(membersList) ? membersList : []);
        }
      } catch (err) {
        console.error("❌ Failed to fetch members:", err);
      }
    };

    fetchMembers();
  }, [selectedGroup, token]);

  // Join group room on socket when group is selected
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedGroup) return;

    console.log("🚪 Joining group room:", selectedGroup.id);
    socket.emit('join_group', { groupId: selectedGroup.id });

    return () => {
      console.log("🚪 Leaving group room:", selectedGroup.id);
      socket.emit('leave_group', { groupId: selectedGroup.id });
    };
  }, [selectedGroup]);

  // Socket event listeners for group messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedGroup) return;

    const handleGroupMessage = (data) => {
      console.log("📨 Received group message - ID:", data._id, "Type:", typeof data._id);
      if (data.groupId === selectedGroup.id) {
        setMessages((prev) => {
          // Double check: convert both to strings to ensure proper comparison
          const messageExists = prev.some((m) => String(m._id) === String(data._id));
          console.log("Message exists?", messageExists, "Comparing:", data._id, "vs existing:", prev.map(m => m._id));
          
          // SKIP if message already exists
          if (messageExists) {
            console.log("⏭️ SKIPPED duplicate:", data._id);
            return prev;
          }
          
          console.log("✅ ADDED message:", data._id);
          return [
            ...prev,
            {
              _id: data._id,
              fromUserId: data.fromUserId,
              fromUserName: data.fromUserName,
              message: data.message,
              time: data.time || data.createdAt || new Date().toISOString(),
              read: true,
            },
          ];
        });

        // Track last message for this group
        setLastMessages((prev) => ({
          ...prev,
          [data.groupId]: {
            userName: data.fromUserName,
            message: data.message,
            time: data.time || data.createdAt,
          },
        }));
      }
    };

    // Listen for read receipts
    const handleMessageRead = (data) => {
      console.log("� Received read receipt:", data);
      if (data.groupId === selectedGroup.id) {
        setMessageReadStatus((prev) => ({
          ...prev,
          [data.messageId]: {
            ...(prev[data.messageId] || {}),
            [data.userId]: {
              userName: data.userName,
              readAt: data.readAt,
            },
          },
        }));
      }
    };

    // Remove all old listeners to prevent stacking
    socket.removeAllListeners(SOCKET_EVENTS.GROUP_MESSAGE);
    socket.removeAllListeners(SOCKET_EVENTS.READ_RECEIPT);

    socket.on(SOCKET_EVENTS.GROUP_MESSAGE, handleGroupMessage);
    socket.on(SOCKET_EVENTS.READ_RECEIPT, handleMessageRead);

    return () => {
      socket.removeAllListeners(SOCKET_EVENTS.GROUP_MESSAGE);
      socket.removeAllListeners(SOCKET_EVENTS.READ_RECEIPT);
    };
  }, [selectedGroup]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages]);

  // Emit read receipt when viewing messages from others
  // Mark messages as read when viewing
  useEffect(() => {
    if (!selectedGroup || !messages.length) return;

    const socket = getSocket();
    if (!socket) return;

    console.log("📨 Marking messages as read...");

    // Mark all messages from others as read by current user
    messages.forEach((msg) => {
      if (msg.fromUserId !== currentUserId) {
        // Check if current user has already marked this as read
        if (!messageReadStatus[msg._id]?.[currentUserId]) {
          console.log("✅ Marking message as read:", msg._id, "by", currentUserName);
          
          setMessageReadStatus((prev) => ({
            ...prev,
            [msg._id]: {
              ...(prev[msg._id] || {}),
              [currentUserId]: {
                userName: currentUserName,
                readAt: new Date().toISOString(),
              },
            },
          }));

          // EMIT READ RECEIPT TO OTHER USERS
          socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
            messageId: msg._id,
            groupId: selectedGroup.id,
            userId: currentUserId,
            userName: currentUserName,
            readAt: new Date().toISOString(),
          });
        }
      }
    });
  }, [messages, selectedGroup, currentUserId, currentUserName]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const aIsPinned = pinnedGroups.includes(a.id);
        const bIsPinned = pinnedGroups.includes(b.id);
        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;
        return 0;
      });
  }, [groups, searchQuery, pinnedGroups]);

  // Send group message
  const handleSendMessage = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !selectedGroup || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(""); // Clear immediately for better UX
    
    try {
      // Debug logging
      console.log("📤 Sending message:", {
        groupId: selectedGroup.id,
        message: messageText,
        token: !!localStorage.getItem("token"),
        socketConnected: socket.connected
      });
      
      // Call messageService to send message
      const savedMessage = await messageService.sendGroupMessage(
        selectedGroup.id,
        messageText
      );
      
      console.log("✅ Message sent successfully:", savedMessage);

      if (!savedMessage || !savedMessage._id) {
        throw new Error("Failed to send message - no message ID returned");
      }

      // ADD MESSAGE TO UI IMMEDIATELY (Optimistic Update)
      const newMsg = {
        _id: savedMessage._id,
        fromUserId: currentUserId,
        fromUserName: currentUserName,
        message: messageText,
        time: savedMessage.createdAt || new Date().toISOString(),
        read: true,
      };
      
      setMessages((prev) => [...prev, newMsg]);

      // Emit socket event to trigger backend broadcast
      socket.emit(SOCKET_EVENTS.GROUP_MESSAGE, {
        message: messageText,
        fromUserId: currentUserId,
        fromUserName: currentUserName,
        _id: savedMessage._id,
        groupId: selectedGroup.id,
        createdAt: savedMessage.createdAt || new Date().toISOString(),
      });

      setError(null);
    } catch (err) {
      console.error("❌ Failed to send message - Full error:", err);
      setNewMessage(messageText); // Restore message on error
      const errorMsg = err.response?.data?.message || err.message || "Unknown error";
      setError("Failed to send message: " + errorMsg);
    }
  }, [selectedGroup, newMessage, currentUserId, currentUserName]);

  const togglePinGroup = useCallback((groupId) => {
    setPinnedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

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

  // Handle create group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }

    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    setCreatingGroup(true);
    try {
      console.log("📤 Creating group with:", {
        groupName,
        memberIds: selectedMembers,
      });

      const newGroup = await groupService.createGroup(
        groupName,
        selectedMembers
      );

      console.log("✅ Group created:", newGroup);
      
      // Add new group to the list
      setGroups((prev) => [
        ...prev,
        {
          groupId: newGroup._id || newGroup.id,
          id: newGroup._id || newGroup.id,
          name: newGroup.name,
          description: newGroup.description || "",
          membersCount: newGroup.members?.length || newGroup.participants?.length || selectedMembers.length + 1,
          createdAt: newGroup.createdAt,
        },
      ]);

      // Reset form
      setGroupName("");
      setSelectedMembers([]);
      setSearchUsers("");
      setShowCreateGroupModal(false);
      alert("✅ Group created successfully!");
    } catch (err) {
      console.error("❌ Failed to create group:", err);
      const errorMsg = err.response?.data?.message || err.message || "Unknown error";
      alert("Failed to create group: " + errorMsg);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Toggle member selection
  const toggleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return availableUsers.filter(
      (user) =>
        (user.name.toLowerCase().includes(searchUsers.toLowerCase()) ||
          user.email.toLowerCase().includes(searchUsers.toLowerCase())) &&
        !selectedMembers.includes(user.userId || user._id)
    );
  }, [availableUsers, searchUsers, selectedMembers]);

  // Fetch users to add to existing group
  const fetchUsersToAdd = useCallback(async () => {
    try {
      const response = await axios.get("/users", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.data.success) {
        // Filter out already existing members
        const nonMembers = response.data.data.filter(
          (user) =>
            !members.some(
              (m) => (m._id || m.userId) === (user._id || user.userId)
            )
        );
        setUsersToAddList(nonMembers);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, [token, members]);

  // Handle add member to group
  const handleAddMember = async () => {
    if (selectedUsersToAdd.length === 0) {
      alert("Please select at least one member to add");
      return;
    }

    setAddMemberLoading(true);
    try {
      // Add each selected user
      for (const userId of selectedUsersToAdd) {
        await groupService.addMember(selectedGroup.id, userId);
      }

      // Refresh group members
      const updatedGroup = await groupService.getGroup(selectedGroup.id);
      setMembers(updatedGroup.members || updatedGroup.participants || []);
      
      // Update group in list
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroup.id
            ? {
                ...g,
                membersCount:
                  updatedGroup.members?.length ||
                  updatedGroup.participants?.length ||
                  0,
              }
            : g
        )
      );

      setSelectedGroup((prev) => ({
        ...prev,
        membersCount:
          updatedGroup.members?.length ||
          updatedGroup.participants?.length ||
          0,
      }));

      // Reset and close modal
      setSelectedUsersToAdd([]);
      setShowAddMemberModal(false);
      alert("Member(s) added successfully!");
    } catch (err) {
      console.error("Failed to add member:", err);
      alert("Failed to add member: " + (err.message || "Unknown error"));
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Handle remove member from group
  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) {
      return;
    }

    setRemoveMemberLoading(memberId);
    try {
      await groupService.removeMember(selectedGroup.id, memberId);

      // Refresh group members
      const updatedGroup = await groupService.getGroup(selectedGroup.id);
      setMembers(updatedGroup.members || updatedGroup.participants || []);

      // Update group in list
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroup.id
            ? {
                ...g,
                membersCount:
                  updatedGroup.members?.length ||
                  updatedGroup.participants?.length ||
                  0,
              }
            : g
        )
      );

      setSelectedGroup((prev) => ({
        ...prev,
        membersCount:
          updatedGroup.members?.length ||
          updatedGroup.participants?.length ||
          0,
      }));

      alert("Member removed successfully!");
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove member: " + (err.message || "Unknown error"));
    } finally {
      setRemoveMemberLoading(null);
    }
  };

  return (
    <>
      {/* Groups Sidebar */}
      <div
        className={`${sidebarOpen ? "w-full  sm:w-72 md:w-80" : "w-0"} bg-[rgb(var(--bg-secondary))] sm:glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col transition-all duration-300 overflow-hidden absolute sm:relative sm:z-0 z-40 h-full sm:h-auto`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-300">Groups</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400"
              title="Create Group"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 sm:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 px-4">
            <Users className="w-4 h-4" />
            Groups ({filteredGroups.length})
          </div>

          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No groups found</p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const id = group.id;
              const isPinned = pinnedGroups.includes(id);
              const unreadCount = unreadCounts[id] || 0;
              const lastMsg = lastMessages[id];
              // Count online members (for now we'll show total members, this can be enhanced with real online tracking)
              const onlineCount = group.membersCount;

              return (
                <div
                  key={id}
                  onClick={() => setSelectedGroup(group)}
                  className={`group relative p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all ${
                    selectedGroup?.id === id
                      ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                      : "hover:bg-[rgb(var(--bg-hover))]/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-gray-100 font-bold text-lg shadow-lg bg-linear-to-br from-purple-500 to-pink-600 relative">
                      {group.name.charAt(0).toUpperCase()}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[rgb(var(--bg-secondary))]"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h5 className="font-semibold text-gray-600 truncate">
                            {group.name}
                          </h5>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-green-400 shrink-0" />
                          )}
                        </div>
                      </div>
                      
                      {/* Last Message Preview */}
                      {lastMsg ? (
                        <p className="text-xs text-gray-400 truncate mt-1">
                          <span className="font-medium text-green-400">{lastMsg.userName}:</span> {lastMsg.message}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          👥 {onlineCount} members online
                        </p>
                      )}
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
                      togglePinGroup(id);
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

      {/* Group Chat Area */}
      <div className="flex-1 flex flex-col bg-[rgb(var(--bg-primary))]">
        {selectedGroup ? (
          <>
            {/* Group Header */}
            <div className="p-3 sm:p-4 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 sm:hidden"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center text-gray-100 font-bold shadow-lg text-sm sm:text-base">
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-700 text-base sm:text-lg truncate">
                    {selectedGroup.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-xs text-green-400 font-medium">
                      {members.length} online • {members.length} members
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowMembersPreview(!showMembersPreview)}
                className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400 shrink-0"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>

            {/* Members Preview */}
            {showMembersPreview && (
              <div className="p-4 sm:p-6 bg-gradient-to-b from-[rgb(var(--bg-secondary))] to-[rgb(var(--bg-tertiary))]/30 border-b-2 border-green-500/20 max-h-72 overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-gradient-to-b from-[rgb(var(--bg-secondary))] to-transparent pb-3 z-10">
                  <div>
                    <h4 className="text-base font-bold text-gray-200">
                      👥 Members
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {members.length} {members.length === 1 ? 'member' : 'members'} in this group
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddMemberModal(true);
                      setSearchUsersToAdd("");
                      setSelectedUsersToAdd([]);
                      fetchUsersToAdd();
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-green-500/50 glow-green"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {/* Members List */}
                <div className="space-y-2">
                  {members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No members yet</p>
                    </div>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member._id || member.userId}
                        className="flex items-center justify-between gap-3 p-3 bg-[rgb(var(--bg-hover))]/40 hover:bg-[rgb(var(--bg-hover))]/70 rounded-xl border border-[rgb(var(--border-secondary))]/50 hover:border-green-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shrink-0 shadow-lg text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-200 truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member._id || member.userId)}
                          disabled={removeMemberLoading === (member._id || member.userId)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400 disabled:opacity-50 shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          {removeMemberLoading === (member._id || member.userId) ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">
                      Loading messages...
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="w-24 h-24 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-lg">
                    <MessageCircle className="w-12 h-12 text-green-500/50" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {selectedGroup.name}
                  </h3>
                  <p className="text-gray-500 text-center max-w-md">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.fromUserId === currentUserId;
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].fromUserId !== msg.fromUserId;

                  return (
                    <div
                      key={msg._id || index}
                      className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      {showAvatar ? (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                            isOwn
                              ? "bg-linear-to-br from-blue-500 to-purple-600"
                              : "bg-linear-to-br from-purple-500 to-pink-600"
                          }`}
                        >
                          {msg.fromUserName.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8"></div>
                      )}

                      <div
                        className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}
                      >
                        {showAvatar && !isOwn && (
                          <p className="text-xs text-gray-400 mb-1">
                            {msg.fromUserName}
                          </p>
                        )}
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
                            {msg.message}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTime(msg.time)}
                          </span>
                          {isOwn && (
                            <div className="flex items-center gap-1">
                              {messageReadStatus[msg._id] &&
                                Object.keys(messageReadStatus[msg._id]).length > 0 ? (
                                <div className="group relative cursor-pointer">
                                  <CheckCheck className="w-4 h-4 text-green-400 hover:scale-110 transition-transform" />
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-[rgb(var(--bg-secondary))] border-2 border-green-500/30 rounded-xl p-4 text-xs text-gray-300 w-80 shadow-2xl z-50">
                                    {/* Read By Section */}
                                    <div className="mb-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <CheckCheck className="w-4 h-4 text-green-400" />
                                        <span className="font-bold text-green-400">
                                          Read by
                                        </span>
                                        <span className="text-gray-500">
                                          ({Object.keys(messageReadStatus[msg._id]).length})
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {Object.values(messageReadStatus[msg._id]).map(
                                          (reader, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center gap-3 p-2 rounded-lg bg-[rgb(var(--bg-hover))]/40 hover:bg-[rgb(var(--bg-hover))]/60"
                                            >
                                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                {reader.userName
                                                  .charAt(0)
                                                  .toUpperCase()}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-gray-200 truncate">
                                                  {reader.userName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                  {reader.readAt
                                                    ? new Date(
                                                        reader.readAt
                                                      ).toLocaleTimeString(
                                                        "en-US",
                                                        {
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                          hour12: true,
                                                        }
                                                      )
                                                    : "Just now"}
                                                </p>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    {/* Delivered To Section */}
                                    {members.length >
                                      Object.keys(messageReadStatus[msg._id])
                                        .length && (
                                      <div className="border-t border-[rgb(var(--border-secondary))] pt-3">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Check className="w-4 h-4 text-gray-500" />
                                          <span className="font-bold text-gray-400">
                                            Delivered to
                                          </span>
                                          <span className="text-gray-600">
                                            (
                                            {members.length -
                                              Object.keys(messageReadStatus[msg._id])
                                                .length}
                                            )
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          {members
                                            .filter(
                                              (member) =>
                                                !messageReadStatus[msg._id]?.[
                                                  member._id || member.userId
                                                ] &&
                                                (member._id || member.userId) !==
                                                  currentUserId
                                            )
                                            .map((member) => (
                                              <div
                                                key={
                                                  member._id || member.userId
                                                }
                                                className="flex items-center gap-3 p-2 rounded-lg bg-[rgb(var(--bg-hover))]/20"
                                              >
                                                <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                  {member.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-semibold text-gray-300 truncate">
                                                    {member.name}
                                                  </p>
                                                  <p className="text-xs text-gray-600">
                                                    Waiting...
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Check className="w-4 h-4 text-gray-500 cursor-pointer" />
                              )}
                            </div>
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
                </div>

                <div className="flex-1 glass-effect rounded-2xl border border-[rgb(var(--border-secondary))] focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
                  <textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full px-4 py-3 bg-transparent text-gray-300 placeholder-gray-500 resize-none focus:outline-none max-h-32 custom-scrollbar"
                    style={{ minHeight: "48px" }}
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`p-2 sm:p-3 rounded-xl transition-all shadow-lg shrink-0 ${
                    newMessage.trim()
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
            <div className="w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-linear-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center mb-4 sm:mb-6 shadow-2xl">
              <Users className="w-12 sm:w-16 h-12 sm:h-16 text-purple-500/50" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 gradient-text text-center">
              Select a Group
            </h3>
            <p className="text-gray-500 text-center text-sm sm:text-base max-w-md">
              Choose a group from the sidebar to view and send messages
            </p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-[rgb(var(--border-secondary))]">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between sticky top-0 bg-[rgb(var(--bg-secondary))]">
              <h3 className="text-xl font-bold text-gray-300">Create Group</h3>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setSearchUsers("");
                }}
                className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Group Name Input */}
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent"
                />
              </div>

              {/* User Search */}
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">
                  Add Members
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="bg-[rgb(var(--bg-hover))]/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-2 font-semibold">
                    Selected Members ({selectedMembers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((memberId) => {
                      const member = availableUsers.find(
                        (u) => (u.userId || u._id) === memberId
                      );
                      return (
                        <div
                          key={memberId}
                          className="bg-green-500/20 border border-green-500/30 text-green-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                        >
                          <span>{member?.name}</span>
                          <button
                            onClick={() => toggleMemberSelection(memberId)}
                            className="hover:text-green-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Users List */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                {filteredUsers.length === 0 && searchUsers.length > 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p className="text-sm">No users found</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p className="text-sm">Loading users...</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const userId = user.userId || user._id;
                    const isSelected = selectedMembers.includes(userId);
                    return (
                      <button
                        key={userId}
                        onClick={() => {
                          toggleMemberSelection(userId);
                        }}
                        className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                          isSelected
                            ? "bg-blue-500/20 border border-blue-500/30"
                            : "hover:bg-[rgb(var(--bg-hover))]/50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-300 truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-blue-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-[rgb(var(--border-secondary))] flex gap-3 sticky bottom-0 bg-[rgb(var(--bg-secondary))]">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setSearchUsers("");
                }}
                className="flex-1 px-4 py-2 bg-[rgb(var(--bg-hover))] text-gray-300 rounded-lg hover:bg-[rgb(var(--bg-hover))]/70 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
                className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold ${
                  creatingGroup || !groupName.trim() || selectedMembers.length === 0
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-linear-to-br from-green-600 to-emerald-700 text-black hover:from-green-500 hover:to-emerald-600 glow-green"
                }`}
              >
                {creatingGroup && <Loader className="w-4 h-4 animate-spin" />}
                {creatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-green-500/20 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-[rgb(var(--bg-secondary))] to-green-950/20 border-b-2 border-green-500/20 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-100">
                  ➕ Add Members
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Adding to <span className="text-green-400 font-semibold">{selectedGroup.name}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUsersToAdd([]);
                  setSearchUsersToAdd("");
                }}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* User Search */}
              <div>
                <label className="text-sm font-semibold text-gray-400 block mb-2">
                  Select Users
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchUsersToAdd} // CHANGED
                    onChange={(e) => setSearchUsersToAdd(e.target.value)} // CHANGED
                    className="w-full pl-10 pr-3 py-2 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Users */}
              {selectedUsersToAdd.length > 0 && (
                <div className="bg-[rgb(var(--bg-hover))]/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-2 font-semibold">
                    Selected Users ({selectedUsersToAdd.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsersToAdd.map((userId) => {
                      const user = usersToAddList.find(
                        (u) => (u.userId || u._id) === userId
                      );
                      return (
                        <div
                          key={userId}
                          className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                        >
                          <span>{user?.name}</span>
                          <button
                            onClick={() => {
                              setSelectedUsersToAdd((prev) =>
                                prev.filter((id) => id !== userId)
                              );
                            }}
                            className="hover:text-blue-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Users List - UPDATED FILTER */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                {usersToAddList.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p className="text-sm">
                      {members.length === availableUsers?.length
                        ? "All users are already members"
                        : "Loading users..."}
                    </p>
                  </div>
                ) : (
                  usersToAddList
                    .filter((user) => {
                      const userId = user.userId || user._id;
                      const userStr = `${user.name} ${user.email}`.toLowerCase();
                      return userStr.includes(searchUsersToAdd.toLowerCase()); // CHANGED
                    })
                    .map((user) => {
                      const userId = user.userId || user._id;
                      const isSelected = selectedUsersToAdd.includes(userId);
                      return (
                        <button
                          key={userId}
                          onClick={() => {
                            setSelectedUsersToAdd((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== userId)
                                : [...prev, userId]
                            );
                          }}
                          className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                            isSelected
                              ? "bg-blue-500/20 border border-blue-500/30"
                              : "hover:bg-[rgb(var(--bg-hover))]/50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-300 truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {user.email}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-blue-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-[rgb(var(--border-secondary))] flex gap-3 sticky bottom-0 bg-[rgb(var(--bg-secondary))]">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUsersToAdd([]);
                  setSearchUsersToAdd(""); // CHANGED
                }}
                className="flex-1 px-4 py-2 bg-[rgb(var(--bg-hover))] text-gray-300 rounded-lg hover:bg-[rgb(var(--bg-hover))]/70 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={
                  addMemberLoading ||
                  selectedUsersToAdd.length === 0 ||
                  !selectedGroup
                }
                className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold ${
                  addMemberLoading || selectedUsersToAdd.length === 0
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-linear-to-br from-blue-600 to-cyan-700 text-white hover:from-blue-500 hover:to-cyan-600 glow-blue"
                }`}
              >
                {addMemberLoading && <Loader className="w-4 h-4 animate-spin" />}
                {addMemberLoading ? "Adding..." : "Add Members"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

