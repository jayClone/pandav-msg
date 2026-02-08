import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react'
import axios from 'axios'
import groupService from '@services/group.service.js'
// import messageService from '@services/message.service.js'
import { SOCKET_EVENTS } from '@constants/socketEvents.js'
import { connectSocket, getSocket } from '@socket/socketClient.js'
import {
  Plus,
  Search,
  Users,
  Pin,
  MessageCircle,
  Menu,
  ChevronLeft,
  Send,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  X,
  Loader,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import friendAPI from '@api/friend.api.js'

export default function GroupChat({
  sidebarOpen,
  setSidebarOpen,
  token,
  currentUserName,
  currentUserId,
}) {
  // ═══════════════════════════════════════════════════════════════════
  // STATE DECLARATIONS (FIRST)
  // ═══════════════════════════════════════════════════════════════════
  
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMembersPreview, setShowMembersPreview] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedGroups, setPinnedGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
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
  const [searchUsersToAdd, setSearchUsersToAdd] = useState("");
  const [messageReadStatus, setMessageReadStatus] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0); // ✅ ADD THIS
  const [lastMessages, setLastMessages] = useState({}); // ✅ ADD THIS

  const messageInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Format time
  // ═══════════════════════════════════════════════════════════════════
  const formatTime = useCallback((timestamp) => {
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
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Handle message read
  // ═══════════════════════════════════════════════════════════════════
  const handleMessageRead = useCallback((messageId, readByData) => {
    console.log('📖 Handling message read:', { messageId, readByData });
    
    setMessageReadStatus((prev) => ({
      ...prev,
      [messageId]: {
        readBy: readByData || [],
        readCount: readByData?.length || 0,
        lastReadAt: new Date(),
      },
    }));

    // Update messages array
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId 
          ? { ...msg, readBy: readByData || [], read: true } 
          : msg
      )
    );
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Render message with ticks
  // ═══════════════════════════════════════════════════════════════════
  const renderMessage = useCallback((msg, index) => {
    const isOwnMessage = msg.fromUserId === currentUserId;
  
    // ✅ PRIORITY: Use messageReadStatus first, fallback to msg.readBy
    const readStatus = messageReadStatus[msg._id] || (msg.readBy?.length > 0 ? {
      readBy: msg.readBy,
      readCount: msg.readBy.length,
    } : null);
  
    // Check if all members (except sender) have read the message
    const totalOtherMembers = members.filter(m => {
      const memberId = m._id || m.userId;
      const msgSenderId = msg.fromUserId;
      return memberId?.toString() !== msgSenderId?.toString();
    }).length;
  
    const readCount = readStatus?.readCount || 0;
    const isReadByAll = readCount >= totalOtherMembers && totalOtherMembers > 0;

    return (
      <div
        key={`${msg._id}-${index}`}
        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} mb-4 group`}
      >
        {/* Avatar - Only show for other users' messages */}
        {!isOwnMessage && (
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1">
            {msg.fromUserName?.charAt(0).toUpperCase() || '?'}
          </div>
        )}

        {/* Message Container */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-xs`}>
          {/* Sender Name - Only for other users */}
          {!isOwnMessage && (
            <p className="text-xs text-gray-400 mb-1 font-semibold px-3">
              {msg.fromUserName}
            </p>
          )}

          {/* Message Box */}
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-lg ${
              isOwnMessage
                ? 'bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm'
                : 'bg-gray-700 text-gray-100 rounded-tl-sm'
            }`}
          >
            <p className="text-sm leading-relaxed">{msg.message}</p>
          </div>

          {/* Time & Read Status Row */}
          <div className={`flex items-center gap-2 mt-1 px-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs text-gray-500">{formatTime(msg.time)}</span>

            {/* TICKS - Only show for own messages */}
            {isOwnMessage && (
              <div className="flex items-center gap-1">
                {!readStatus ? (
                  // ✅ SINGLE TICK - Message sent but not read
                  <span className="text-gray-400 text-sm font-bold">✓</span>
                ) : isReadByAll ? (
                  // ✅ DOUBLE BLUE TICK - Read by ALL members
                  <span className="text-blue-400 text-sm font-bold">✓✓</span>
                ) : (
                  // ✅ DOUBLE GRAY TICK - Read by some members
                  <span className="text-gray-400 text-sm font-bold">✓✓</span>
                )}

                {/* Show read count badge */}
                {readStatus && readCount > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isReadByAll 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-gray-600/20 text-gray-400'
                  }`}>
                    {readCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Show who read it - Visible on hover */}
          {isOwnMessage && readStatus && readStatus.readBy?.length > 0 && (
            <div className="mt-2 text-xs text-gray-400 bg-gray-800/70 px-3 py-2 rounded-lg hidden group-hover:block whitespace-nowrap max-w-xs">
              {readStatus.readBy.length === 1 ? (
                <p>✓ Read by {readStatus.readBy[0].userName}</p>
              ) : readStatus.readBy.length === 2 ? (
                <p>✓✓ Read by {readStatus.readBy.map(r => r.userName).join(' & ')}</p>
              ) : (
                <>
                  <p className="font-semibold mb-1">Read by {readStatus.readBy.length}:</p>
                  {readStatus.readBy.map((r) => (
                    <p key={r.userId} className="ml-2">
                      • {r.userName}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [currentUserId, messageReadStatus, members, formatTime]);

  // ═══════════════════════════════════════════════════════════════════
  // MEMOIZED VALUES (SECOND)
  // ═══════════════════════════════════════════════════════════════════

  // ✅ SAFE SELECTED GROUP MEMOIZED GETTER
  const safeSelectedGroup = useMemo(() => {
    if (!selectedGroup || !selectedGroup.id) return null;
    return {
      ...selectedGroup,
      name: selectedGroup.name || 'Unnamed Group'
    };
  }, [selectedGroup]);

  // ✅ SAFE FILTERED GROUPS WITH VALIDATION
  const filteredGroups = useMemo(() => {
    const safeGroups = Array.isArray(groups) ? groups : [];
    
    return safeGroups
      .filter(group => {
        if (!group || !group.id || !group.name) {
          console.warn('⚠️ Invalid group filtered out:', group);
          return false;
        }
        return true;
      })
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

  // ═══════════════════════════════════════════════════════════════════
  // CALLBACK FUNCTIONS (THIRD - BEFORE useEffect)
  // ═══════════════════════════════════════════════════════════════════

  // ✅ FIX: Define fetchAllGroups BEFORE using it in useEffect
  const fetchAllGroups = useCallback(async () => {
    if (!token) {
      console.warn('⚠️ No token available');
      setGroups([]);
      return;
    }

    try {
      console.log('📥 Fetching groups...');
      const groups = await groupService.getMyGroups();
      
      if (!Array.isArray(groups)) {
        console.error('❌ Groups response is not an array:', groups);
        setGroups([]);
        return;
      }

      const formattedGroups = groups
        .filter(g => g && g._id && g.name)
        .map((g) => {
          const groupName = g.name || g.groupName || 'Unnamed Group';
          const groupId = g._id || g.groupId;
          
          if (!groupId) {
            console.warn('⚠️ Group without ID found:', g);
            return null;
          }
          
          return {
            groupId: groupId,
            id: groupId,
            name: groupName.trim() || 'Unnamed Group',
            description: g.description || '',
            membersCount: g.members?.length || g.participants?.length || 0,
            createdAt: g.createdAt,
          };
        })
        .filter(Boolean);

      console.log(`✅ ${formattedGroups.length} groups loaded`);
      setGroups(formattedGroups);
    } catch (err) {
      console.error('❌ Failed to fetch groups:', err.message);
      setError('Failed to load groups');
      setGroups([]);
    }
  }, [token]);

  // ✅ FIX: Now handleSelectGroup is actually used
  const handleSelectGroup = useCallback(async (group) => {
    setSelectedGroup(group);
    setMembers([]); 
    setMessageReadStatus({}); // Reset first
  
    try {
      setLoading(true);
      const groupDetails = await groupService.getGroup(group.id);
      
      const groupMembers = groupDetails.members || groupDetails.participants || [];
      setMembers(groupMembers);
      setOnlineCount(groupMembers.length); // ✅ Set online count
      
      console.log('✅ Group members loaded:', groupMembers.length);
    } catch (err) {
      console.error('❌ Failed to fetch group details:', err);
    }
  
    try {
      const response = await axios.get(
        `/groups/${group.id}/messages`,
        {
          baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const formattedMessages = (response.data.data || []).map((msg) => ({
          _id: msg._id,
          message: msg.message,
          fromUserId: msg.fromUserId || msg.senderId,
          fromUserName: msg.senderName,
          time: msg.time || msg.createdAt,
          pending: false,
          read: msg.read,
          readBy: msg.readBy || [],
        }));
        setMessages(formattedMessages);

        // ✅ CRITICAL: Initialize readStatus from fetched messages
        const initialReadStatus = {};
        formattedMessages.forEach((msg) => {
          if (msg.readBy && msg.readBy.length > 0) {
            initialReadStatus[msg._id] = {
              readBy: msg.readBy,
              readCount: msg.readBy.length,
              lastReadAt: new Date(msg.readBy[msg.readBy.length - 1].readAt),
            };
          }
        });
        setMessageReadStatus(initialReadStatus);

        console.log('✅ Messages loaded with read status:', Object.keys(initialReadStatus).length);
        
        // ✅ SET LAST MESSAGE FOR THIS GROUP
        if (formattedMessages.length > 0) {
          const lastMsg = formattedMessages[formattedMessages.length - 1];
          setLastMessages((prev) => ({
            ...prev,
            [group.id]: {
              message: lastMsg.message,
              userName: lastMsg.fromUserName,
            }
          }));
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch group messages:", err);
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(SOCKET_EVENTS.JOIN_GROUP, { groupId: group.id });
    }

    setUnreadCounts((prev) => ({
      ...prev,
      [group.id]: 0,
    }));
    
    messageInputRef.current?.focus();
  }, [token]);

  const handleSendMessage = useCallback(async () => {
    const socket = getSocket();
    
    if (!socket?.connected) {
      console.warn('⚠️ Socket not connected');
      return;
    }
    
    if (!selectedGroup || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    
    try {
      console.log("📤 Sending message via Socket:", {
        groupId: selectedGroup.id,
        message: messageText,
      });
      
      socket.emit(SOCKET_EVENTS.GROUP_MESSAGE, {
        groupId: selectedGroup.id,
        message: messageText,
        fromUserId: currentUserId,
        fromUserName: currentUserName,
      });

      console.log('✅ Message emitted to socket');
      messageInputRef.current?.focus();
      
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      setNewMessage(messageText);
    }
  }, [selectedGroup, newMessage, currentUserId, currentUserName]);

  const togglePinGroup = useCallback((groupId) => {
    setPinnedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

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

  const toggleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

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

  const handleAddMember = async () => {
    if (selectedUsersToAdd.length === 0) {
      alert("Please select at least one member to add");
      return;
    }

    setAddMemberLoading(true);
    try {
      for (const userId of selectedUsersToAdd) {
        await groupService.addMember(selectedGroup.id, userId);
      }

      const updatedGroup = await groupService.getGroup(selectedGroup.id);
      setMembers(updatedGroup.members || updatedGroup.participants || []);
      
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

  const handleRemoveMember = async (memberId) => {
    if (!selectedGroup) return;
  
    if (!confirm("Are you sure you want to remove this member from the group?")) {
      return;
    }

    setRemoveMemberLoading(memberId);
    try {
      console.log('🗑️ Removing member:', memberId);
      
      const updatedGroup = await groupService.removeMember(
        selectedGroup.id,
        memberId
      );

      const updatedMembers = (updatedGroup.members || updatedGroup.participants || []);
      setMembers(updatedMembers);
      setOnlineCount(updatedMembers.length); // ✅ Update online count
      
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroup.id
            ? { ...g, membersCount: updatedMembers.length }
            : g
        )
      );

      console.log('✅ Member removed successfully');
      alert('✅ Member removed from group');
    } catch (err) {
      console.error('❌ Failed to remove member:', err);
      alert('Failed to remove member: ' + (err.response?.data?.message || err.message));
    } finally {
      setRemoveMemberLoading(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('⚠️ Are you sure? This will delete the group and all its messages permanently.')) {
      return;
    }

    setDeletingGroup(true);
    try {
      await groupService.deleteGroup(selectedGroup.id);
      
      setGroups((prev) => prev.filter(g => g.id !== selectedGroup.id));
      
      setSelectedGroup(null);
      
      alert('✅ Group deleted successfully!');
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingGroup(false);
    }
  };

  const fetchAvailableUsers = useCallback(async () => {
    try {
      await axios.get("/users", {
        baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, [token]);

  // In the create group modal's member list section:
  // Instead of fetching all users, fetch only friends
  useEffect(() => {
    const fetchFriendsForGroup = async () => {
      try {
        const response = await friendAPI.getFriends();
        setAvailableUsers(response.data.data || []);
      } catch (error) {
        console.error('❌ Error fetching friends:', error.message);
      }
    };

    if (showCreateGroupModal && token) {
      fetchFriendsForGroup();
    }
  }, [showCreateGroupModal, token]);

  // ═══════════════════════════════════════════════════════════════════
  // EFFECTS (FOURTH - NOW fetchAllGroups is defined)
  // ═══════════════════════════════════════════════════════════════════

  // ✅ FIX: Fetch groups on component mount
  useEffect(() => {
    console.log('🔄 GroupChat mounted - fetching groups...');
    fetchAllGroups();
  }, [token, fetchAllGroups]);

  // ✅ Connect socket when component mounts
  useEffect(() => {
    if (!token) {
      console.warn('⚠️ No token available for socket');
      return;
    }

    console.log('🔌 Connecting socket...');
    const socket = connectSocket(token);
  
    console.log('🔌 Socket connected:', {
      id: socket?.id,
      connected: socket?.connected,
      url: socket?.io?.uri
    });

    // ✅ Listen for connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [token])

  // ✅ Listen for group messages using SOCKET_EVENTS
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    console.log('🎧 Setting up group_message listener...');

    socket.on(SOCKET_EVENTS.GROUP_MESSAGE, (data) => {
      console.log('💬 Received group_message event:', data);
      
      if (!data?.groupId) {
        console.warn('⚠️ Invalid message data:', data);
        return;
      }

      if (data.groupId === selectedGroup?.id) {
        const newMsg = {
          _id: data._id || `msg_${Date.now()}`,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || 'Unknown',
          message: data.message,
          time: data.createdAt || new Date().toISOString(),
          pending: false,
          read: false,
          readBy: data.readBy || [], // ✅ Include readBy from socket
        };

        console.log('✅ Adding message:', newMsg._id);
        setMessages((prev) => [...prev, newMsg]);
        
        // ✅ Update last message
        setLastMessages((prev) => ({
          ...prev,
          [data.groupId]: {
            message: data.message,
            userName: data.fromUserName,
          }
        }));
      } else {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.groupId]: (prev[data.groupId] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.off(SOCKET_EVENTS.GROUP_MESSAGE);
    };
  }, [selectedGroup?.id]);

  // ✅ Listen for read receipts
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('message_read', (data) => {
      console.log('📖 Message read receipt:', data);
      
      // ✅ FIXED: Call handleMessageRead with correct data
      if (data.messageId && data.readBy) {
        handleMessageRead(data.messageId, data.readBy);
      }
    });

    return () => {
      socket.off('message_read');
    };
  }, [handleMessageRead]);

  // ✅ Emit read receipts when viewing messages
  useEffect(() => {
    if (!selectedGroup?._id && !selectedGroup?.id) return;
    if (messages.length === 0) return;

    const socket = getSocket();
    if (!socket?.connected) return;

    const timer = setTimeout(() => {
      console.log('📤 [GROUP] Checking messages for read receipt');

      messages.forEach((msg) => {
        if (msg.fromUserId !== currentUserId && !messageReadStatus[msg._id]) {
          console.log(`📤 Emitting read receipt for: ${msg._id}`);
          
          socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
            messageId: msg._id,
            groupId: selectedGroup._id || selectedGroup?.id,
            timestamp: new Date(),
          });
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, selectedGroup?._id, selectedGroup?.id, currentUserId, messageReadStatus]);

  // ✅ Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✅ Fetch available users when create modal opens
  useEffect(() => {
    if (token && showCreateGroupModal) {
      fetchAvailableUsers();
    }
  }, [token, showCreateGroupModal, fetchAvailableUsers]);

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
              if (!group || !group.id) {
                console.warn('⚠️ Invalid group in list:', group);
                return null;  // Skip invalid groups
              }
              
              const id = group.id;
              const isPinned = pinnedGroups.includes(id);
              const unreadCount = unreadCounts[id] || 0;
              const lastMsg = lastMessages[id]; // ✅ FIX: Use lastMessages state

              return (
                <div
                  key={id}
                  onClick={() => handleSelectGroup(group)}
                  className={`group relative p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all ${
                    selectedGroup?.id === id
                      ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                      : "hover:bg-[rgb(var(--bg-hover))]/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-gray-100 font-bold text-lg shadow-lg bg-linear-to-br from-purple-500 to-pink-600 relative">
                      {(group?.name || 'G').charAt(0).toUpperCase()}
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
                          👥 {group.membersCount} members online
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
                  {(safeSelectedGroup?.name || 'G').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-700 text-base sm:text-lg truncate">
                    {safeSelectedGroup?.name || 'Group'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-xs text-green-400 font-medium">
                      {onlineCount} online • {members.length} members
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
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400 shrink-0"
                title="Delete Group"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Members Preview */}
            {showMembersPreview && (
              <div className="p-4 sm:p-6 bg-linear-to-r from-[rgb(var(--bg-secondary))] to-[rgb(var(--bg-tertiary))]/30 border-b-2 border-green-500/20 max-h-72 overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-linear-to-r from-[rgb(var(--bg-secondary))] to-transparent pb-3 z-10">
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
                    className="px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-green-500/50 glow-green"
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
                    members.map((member) => {
                      // ✅ SAFETY CHECK - Skip invalid members
                      if (!member || (!member._id && !member.userId)) {
                        console.warn('⚠️ Invalid member found:', member);
                        return null;
                      }

                      const memberId = member._id || member.userId;
                      const memberName = member.name || member.email || 'Unknown User';

                      return (
                        <div
                          key={memberId}
                          className="flex items-center justify-between gap-3 p-3 bg-[rgb(var(--bg-hover))]/40 hover:bg-[rgb(var(--bg-hover))]/70 rounded-xl border border-[rgb(var(--border-secondary))]/50 hover:border-green-500/30 transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-linear-to-r from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shrink-0 shadow-lg text-sm">
                              {memberName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-300 truncate">
                                {memberName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.email}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(memberId)}
                            disabled={removeMemberLoading === memberId}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400 disabled:opacity-50 shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            {removeMemberLoading === memberId ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })
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
                    {safeSelectedGroup.name}
                  </h3>
                  <p className="text-gray-500 text-center max-w-md">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => renderMessage(msg, index))
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
                    className="w-full pl-10 pr-3 py-2 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
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

              {/* Users List - PROPERLY FIXED */}
              <div className="space-y-2">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">
                      {searchUsers
                        ? "No users found"
                        : "Loading users..."}
                    </p>
                  </div>
                ) : (
                  availableUsers
                    .filter((user) => {
                      const userStr = `${user.name} ${user.email}`.toLowerCase();
                      return userStr.includes(searchUsers.toLowerCase());
                    })
                    .map((user) => {
                      const userId = user.userId || user._id;
                      const isSelected = selectedMembers.includes(userId);
                      const userName = user.name || user.email || 'Unknown User';

                      return (
                        <button
                          key={userId}
                          onClick={() => {
                            toggleMemberSelection(userId);
                          }}
                          className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                            isSelected
                              ? "bg-green-500/20 border border-green-500/30"
                              : "hover:bg-[rgb(var(--bg-hover))]/50 border border-[rgb(var(--border-secondary))]/50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {userName.charAt(0).toUpperCase()}
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
                            <Check className="w-5 h-5 text-green-400 shrink-0" />
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
                  // ✅ CORRECT: Check if we have valid input
                  !creatingGroup && groupName.trim() && selectedMembers.length > 0
                    ? "bg-linear-to-br from-green-600 to-emerald-700 text-black hover:from-green-500 hover:to-emerald-600 glow-green cursor-pointer"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
                }`}
              >
                {creatingGroup && <Loader className="w-4 h-4 animate-spin" />}
                {creatingGroup ? "Creating..." : `Create Group (${selectedMembers.length})`}
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
            <div className="p-4 sm:p-6 bg-linear-to-r from-[rgb(var(--bg-secondary))] to-green-950/20 border-b-2 border-green-500/20 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-100">
                  ➕ Add Members
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  Adding to <span className="text-green-400 font-semibold">{safeSelectedGroup.name}</span>
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
                    value={searchUsersToAdd}
                    onChange={(e) => setSearchUsersToAdd(e.target.value)}
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
                      const userStr = `${user.name} ${user.email}`.toLowerCase();
                      return userStr.includes(searchUsersToAdd.toLowerCase());
                    })
                    .map((user) => {
                      const userId = user.userId || user._id;
                      const isSelected = selectedUsersToAdd.includes(userId);
                      const userName = user.name || user.email || 'Unknown User';

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
                              ? "bg-green-500/20 border border-green-500/30"
                              : "hover:bg-[rgb(var(--bg-hover))]/50 border border-[rgb(var(--border-secondary))]/50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {userName.charAt(0).toUpperCase()}
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
                            <Check className="w-5 h-5 text-green-400 shrink-0" />
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
                  setSearchUsersToAdd("");
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
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
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
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl max-w-sm w-full border border-red-500/20">
            <div className="p-6 border-b border-red-500/20">
              <h3 className="text-lg font-bold text-gray-300 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                Delete Group?
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                This will permanently delete <span className="text-red-400 font-semibold">{selectedGroup?.name}</span> and all its messages.
              </p>
            </div>
            
            <div className="p-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-[rgb(var(--bg-hover))] text-gray-300 rounded-lg hover:bg-[rgb(var(--bg-hover))]/70 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deletingGroup}
                className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold ${
                  deletingGroup
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-linear-to-br from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600"
                }`}
              >
                {deletingGroup && <Loader className="w-4 h-4 animate-spin" />}
                {deletingGroup ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

