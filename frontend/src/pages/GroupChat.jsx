import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react'
import axios from 'axios'
import groupService from '@services/group.service.js'
import { SOCKET_EVENTS } from '@constants/socketEvents.js'
import { connectSocket, getSocket } from '@socket/socketClient.js'
import {
  Plus,
  Search,
  Users,
  Pin,
  MessageCircle,
  ChevronLeft,
  Send,
  Check,
  Paperclip,
  Smile,
  X,
  Loader,
  Trash2,
  AlertTriangle,
  LogOut, UserPlus, MoreVertical, Menu
} from 'lucide-react'
import friendAPI from '@api/friend.api.js'

export default function GroupChat({
  sidebarOpen,
  setSidebarOpen,
  token,
  currentUserName,
  currentUserId,
  onChatOpen,
  isChatOpen,
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
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastMessages, setLastMessages] = useState({});
  const [groupOnlineMembers, setGroupOnlineMembers] = useState([]);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false); // ✅ ADD FOR MOBILE

  const messageInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ✅ ADD NEW STATE FOR ADMIN INFO
  const [adminInfo, setAdminInfo] = useState(null);

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

    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId 
          ? { ...msg, readBy: readByData || [], read: true } 
          : msg
      )
    );
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTION: Render message with ticks (RESPONSIVE)
  // ═══════════════════════════════════════════════════════════════════
  const renderMessage = useCallback((msg, index) => {
    const isOwnMessage = msg.fromUserId === currentUserId;
  
    const readStatus = messageReadStatus[msg._id] || (msg.readBy?.length > 0 ? {
      readBy: msg.readBy,
      readCount: msg.readBy.length,
    } : null);
  
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
        className={`flex gap-2 sm:gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} mb-3 sm:mb-4 group`}
      >
        {/* Avatar - Only show for other users' messages */}
        {!isOwnMessage && (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-lg">
            {msg.fromUserName?.charAt(0).toUpperCase() || '?'}
          </div>
        )}

        {/* Message Container */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-xs sm:max-w-md`}>
          {/* Sender Name - Only for other users */}
          {!isOwnMessage && (
            <p className="text-xs text-[rgb(var(--text-muted))] mb-1 font-semibold px-3">
              {msg.fromUserName}
            </p>
          )}

          {/* Message Box */}
          <div
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-lg text-sm sm:text-base ${
              isOwnMessage
                ? 'bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-tr-sm'
                : 'bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-primary))] rounded-tl-sm'
            }`}
          >
            <p className="leading-relaxed break-words">{msg.message}</p>
          </div>

          {/* Time & Read Status Row */}
          <div className={`flex items-center gap-1 sm:gap-2 mt-1 px-3 text-xs sm:text-sm ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
            <span className="text-[rgb(var(--text-muted))]">{formatTime(msg.time)}</span>

            {/* TICKS - Only show for own messages */}
            {isOwnMessage && (
              <div className="flex items-center gap-1">
                {!readStatus ? (
                  <span className="text-green-400 font-bold">✓</span>
                ) : isReadByAll ? (
                  <span className="text-blue-400 font-bold">✓✓</span>
                ) : (
                  <span className="text-green-400 font-bold">✓✓</span>
                )}

                {readStatus && readCount > 0 && (
                  <span className={`text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline-block ${
                    isReadByAll 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-[rgb(var(--bg-hover))]/30 text-[rgb(var(--text-muted))]'
                  }`}>
                    {readCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Show who read it - Visible on hover (RESPONSIVE) */}
          {isOwnMessage && readStatus && readStatus.readBy?.length > 0 && (
            <div className="mt-2 text-xs text-[rgb(var(--text-muted))] bg-[rgb(var(--bg-secondary))] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hidden group-hover:block whitespace-nowrap max-w-xs">
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

  const safeSelectedGroup = useMemo(() => {
    if (!selectedGroup || !selectedGroup.id) return null;
    return {
      ...selectedGroup,
      name: selectedGroup.name || 'Unnamed Group'
    };
  }, [selectedGroup]);

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

  const handleSelectGroup = useCallback(async (group) => {
    setSelectedGroup(group);
    setMembers([]); 
    setMessageReadStatus({});
    
    // ✅ ONLY CLOSE SIDEBAR ON MOBILE, NOT ON DESKTOP
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  
    try {
      setLoading(true);
      const groupDetails = await groupService.getGroup(group.id);
      
      const groupMembers = groupDetails.members || groupDetails.participants || [];
      setMembers(groupMembers);
      setOnlineCount(groupMembers.length);
      
      // ✅ SET ADMIN INFO
      setAdminInfo({
        adminId: groupDetails.adminId,
        adminName: groupDetails.adminName,
        adminEmail: groupDetails.adminEmail
      });
      
      console.log('✅ Group admin:', groupDetails.adminName);
      
      // ✅ ADD THIS: Update selectedGroup with adminId
      setSelectedGroup(prev => ({
        ...prev,
        adminId: groupDetails.adminId,
        adminName: groupDetails.adminName
      }));
      
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
  }, [token, setSidebarOpen]);

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
      setAddMemberLoading(true);
      setError(null);

      // ✅ FIX: Fetch FRIENDS list instead of all users
      const response = await friendAPI.getFriends();

      if (response.data?.success) {
        // Get current group members
        const currentMemberIds = members.map(m => m._id || m.userId);

        // Filter out: users already in group, and current user
        const availableUsers = response.data.data.filter(user => {
          const userId = user._id || user.id;
          return (
            userId !== currentUserId && 
            !currentMemberIds.includes(userId)
          );
        });

        console.log(`✅ Fetched ${availableUsers.length} friends not in group`);
        setUsersToAddList(availableUsers);
        setSelectedUsersToAdd([]); // Reset selection
      } else {
        setError('Failed to fetch friends');
        setUsersToAddList([]);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(err.response?.data?.message || 'Failed to fetch users');
      setUsersToAddList([]);
    } finally {
      setAddMemberLoading(false);
    }
  }, [members, currentUserId, token]);


  const handleRemoveMember = async (memberId) => {
    if (!selectedGroup) return;
  
    if (!confirm("Are you sure you want to remove this member from the group?")) {
      return;
    }

    setRemoveMemberLoading(memberId);
    try {
      console.log('🗑️ Removing member:', memberId);
      
      const groupId = selectedGroup._id || selectedGroup.id;
      
      // ✅ Call remove member API
      const updatedGroupResponse = await groupService.removeMember(groupId, memberId);

      console.log('✅ Remove response:', updatedGroupResponse);
      
      // ✅ Get updated members list
      const updatedMembers = updatedGroupResponse.members || updatedGroupResponse.participants || [];
      
      // ✅ UPDATE STATE IMMEDIATELY
      setMembers(updatedMembers);
      setOnlineCount(updatedMembers.length);
      
      // ✅ Update selected group
      setSelectedGroup(prev => ({
        ...prev,
        members: updatedMembers,
        participants: updatedMembers
      }));
      
      // ✅ Update groups list
      setGroups((prev) =>
        prev.map((g) =>
          (g._id || g.id) === groupId
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
    const groupId = selectedGroup?._id || selectedGroup?.id || selectedGroup?.groupId;
  
    if (!groupId) {
      setError('No group selected');
      return;
    }

    try {
      setDeletingGroup(true);
      setError(null);

      console.log('🗑️ Deleting group:', groupId);
      await groupService.deleteGroup(groupId);

      // ✅ UPDATE STATE IMMEDIATELY
      setGroups(prev => {
        const filtered = prev.filter(g => {
          const gId = g._id || g.id || g.groupId;
          return gId !== groupId;
        });
        console.log(`✅ Removed group from list. Remaining: ${filtered.length}`);
        return filtered;
      });

      // ✅ Clear selected group
      setSelectedGroup(null);
      setMessages([]);
      setMembers([]);
      setShowDeleteConfirm(false);
      setAdminInfo(null);
      setShowOptionsMenu(false);
      
      console.log(`✅ Group deleted successfully`);
      alert('✅ Group deleted successfully');
      
    } catch (err) {
      console.error('Delete group error:', err);
      const errorMsg = err.response?.data?.message || 'Failed to delete group';
      setError(errorMsg);
      alert('❌ Failed to delete group: ' + errorMsg);
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
  // EFFECTS (FOURTH)
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    console.log('🔄 GroupChat mounted - fetching groups...');
    fetchAllGroups();
  }, [token, fetchAllGroups]);

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
      // Don't disconnect on unmount
    };
  }, [token])

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
          readBy: data.readBy || [],
        };

        console.log('✅ Adding message:', newMsg._id);
        setMessages((prev) => [...prev, newMsg]);
        
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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('message_read', (data) => {
      console.log('📖 Message read receipt:', data);
      
      if (data.messageId && data.readBy) {
        handleMessageRead(data.messageId, data.readBy);
      }
    });

    return () => {
      socket.off('message_read');
    };
  }, [handleMessageRead]);

  useEffect(() => {
    if (!selectedGroup?.id && !selectedGroup?.name) return;
    if (messages.length === 0) return;

    const socket = getSocket();
    if (!socket?.connected) return;

    const timer = setTimeout(() => {
      messages.forEach((msg) => {
        if (msg.fromUserId === currentUserId) {
          console.log(`⏭️  Skipping own message: ${msg._id}`);
          return;
        }

        const alreadyRead = msg.readBy?.some(
          (r) => r.userId === currentUserId || r.userId?._id === currentUserId
        );

        if (!alreadyRead && msg._id) {
          console.log(`📖 Emitting read receipt for message: ${msg._id}`);
          socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
            messageId: msg._id,
            groupId: selectedGroup._id || selectedGroup.id,
          });
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, selectedGroup?._id, selectedGroup?.id, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (token && showCreateGroupModal) {
      fetchAvailableUsers();
    }
  }, [token, showCreateGroupModal, fetchAvailableUsers]);

  useEffect(() => {
    if (!selectedGroup?.id && !selectedGroup?._id) return;
    
    const socket = getSocket();
    if (!socket?.connected) return;

    console.log("📡 [LISTEN] Setting up group_online_members listener");

    const handleGroupOnlineMembers = (data) => {
      console.log(`🟢 [ONLINE] Group ${data.groupId} has ${data.onlineCount}/${data.totalMembers} members online:`, 
        data.onlineMembers.map(u => u.name).join(', ')
      );
      
      setGroupOnlineMembers(data.onlineMembers || []);
      setOnlineCount(data.onlineCount || 0);
    };

    socket.on('group_online_members', handleGroupOnlineMembers);

    return () => {
      socket.off('group_online_members', handleGroupOnlineMembers);
    };
  }, [selectedGroup?.id, selectedGroup?._id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) return;

    socket.on('user_joined_group', (data) => {
      console.log('👤 User joined group:', data.userName);
      setOnlineCount(data.onlineCount || 0);
    });

    socket.on('user_left_group', (data) => {
      console.log('👤 User left group:', data.userName);
    });

    return () => {
      socket.off('user_joined_group');
      socket.off('user_left_group');
    };
  }, []);

  const handleLeaveGroup = async () => {
    if (!selectedGroup?._id && !selectedGroup?.id) {
      setError("No group selected");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to leave "${selectedGroup.name}"? You can rejoin if invited again.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);

      const groupId = selectedGroup._id || selectedGroup.id;
      console.log("🚪 [LEAVE GROUP] Attempting to leave group:", groupId);

      const response = await groupService.leaveGroup(groupId);

      if (response.success) {
        console.log("✅ [LEAVE GROUP] Successfully left group");

        // ✅ UPDATE STATE IMMEDIATELY
        setGroups((prevGroups) => {
          const filtered = prevGroups.filter((g) => (g._id || g.id) !== groupId);
          console.log(`✅ Removed group. Remaining: ${filtered.length}`);
          return filtered;
        });

        // ✅ Clear selected group and data
        setSelectedGroup(null);
        setMessages([]);
        setMembers([]);
        setShowMembersPreview(false);
        setShowOptionsMenu(false);

        setUnreadCounts((prev) => {
          const updated = { ...prev };
          delete updated[groupId];
          return updated;
        });

        setPinnedGroups((prev) => prev.filter((id) => id !== groupId));

        setError(null);
        alert(`✅ You have left the group "${selectedGroup.name}"`);
        console.log("✅ Group left successfully");
      
      }
    } catch (err) {
      console.error("❌ Leave group error:", err);
      const errorMessage =
        err?.response?.data?.message || err?.message || "Failed to leave group";
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  
useEffect(() => {
  console.log('📊 showOptionsMenu state changed:', showOptionsMenu);
}, [showOptionsMenu]);

// Add this RIGHT AFTER all your other useEffect hooks (around line 900):

useEffect(() => {
  const handleClickOutside = (event) => {
    const menuElement = document.querySelector('[data-options-menu]');
    const buttonElement = document.querySelector('[data-menu-button]');
    
    if (
      showOptionsMenu && 
      menuElement && 
      !menuElement.contains(event.target) &&
      buttonElement &&
      !buttonElement.contains(event.target)
    ) {
      console.log('❌ Click outside menu - closing');
      setShowOptionsMenu(false);
    }
  };

  if (showOptionsMenu) {
    // Use 'click' instead of 'mousedown' - fixes the timing issue
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
}, [showOptionsMenu]);

useEffect(() => {
  if (selectedGroup) {
    console.log('🔍 DEBUG ADMIN CHECK:', {
      selectedGroup_adminId: selectedGroup?.adminId,
      selectedGroup_adminId_type: typeof selectedGroup?.adminId,
      currentUserId: currentUserId,
      currentUserId_type: typeof currentUserId,
      adminId_string: String(selectedGroup?.adminId),
      isAdmin: selectedGroup?.adminId === currentUserId,
      isAdmin_string: String(selectedGroup?.adminId) === String(currentUserId),
    });
  }
}, [selectedGroup, currentUserId]);

  // ✅ HIDE MOBILE BOTTOM NAV WHEN GROUP CHAT IS OPEN
  useEffect(() => {
    if (onChatOpen) {
      onChatOpen(!!selectedGroup);
    }
  }, [selectedGroup, onChatOpen]);

  return (
    <>
      {/* ✅ MAIN CONTENT WRAPPER - Flex row for desktop layout (like Chat page) */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {/* ✅ RESPONSIVE GROUPS SIDEBAR */}
        <div
          className={`${sidebarOpen ? "w-full sm:w-72 md:w-80" : "w-0"} bg-[rgb(var(--bg-secondary))] sm:glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col transition-all duration-300 overflow-hidden absolute sm:relative sm:z-0 z-40 h-full sm:h-auto md:h-full`}
        >
        {/* Header - RESPONSIVE */}
        <div className="p-2 sm:p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between flex-shrink-0">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-[rgb(var(--text-primary))] truncate">📱 Groups</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400"
              title="Create Group"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
           
          </div>
        </div>

        {/* Search Bar - RESPONSIVE & THEME AWARE */}
        <div className="p-2 sm:p-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[rgb(var(--text-muted))]/70" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-[rgb(var(--bg-tertiary))]/50 backdrop-blur-sm border border-[rgb(var(--border-secondary))]/60 rounded-xl text-xs sm:text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))]/70 focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/40 transition-all duration-200 hover:bg-[rgb(var(--bg-tertiary))]/60 hover:border-[rgb(var(--border-secondary))]/80"
            />
          </div>
        </div>

        {/* Groups List - RESPONSIVE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-3 sm:p-4 text-xs font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Groups ({filteredGroups.length})</span>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-[rgb(var(--text-muted))]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 flex-shrink-0" />
              <p className="text-xs sm:text-sm">
                {groups.length === 0 
                  ? "No groups yet" 
                  : "No groups found"}
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2 sm:p-3">
              {filteredGroups.map((group) => {
                if (!group || !group.id) {
                  console.warn('⚠️ Invalid group in list:', group);
                  return null;
                }
                
                const id = group.id;
                const isPinned = pinnedGroups.includes(id);
                const unreadCount = unreadCounts[id] || 0;
                const lastMsg = lastMessages[id];

                return (
                  <div
                    key={id}
                    onClick={() => {
                      handleSelectGroup(group);
                      if (window.innerWidth < 640) {
                        setSidebarOpen(false);
                      }
                    }}
                    className={`group relative p-2 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all ${
                      selectedGroup?.id === id
                        ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                        : "hover:bg-[rgb(var(--bg-hover))]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg bg-linear-to-br from-green-500 to-emerald-600 glow-green">
                          {(group?.name || 'G').charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 sm:w-3 h-2.5 sm:h-3 bg-green-400 border-2 border-[rgb(var(--bg-secondary))] rounded-full animate-pulse"></div>
                      </div>

                      {/* Group Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h5 className="font-semibold text-xs sm:text-sm text-[rgb(var(--text-primary))] truncate">
                            {group.name}
                          </h5>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-green-400 shrink-0" />
                          )}
                        </div>
                        
                        {/* Last Message or Member Count */}
                        {lastMsg ? (
                          <p className="text-xs mt-0.5 text-[rgb(var(--text-muted))] truncate">
                            <span className="font-medium text-green-400">{lastMsg.userName}:</span> {lastMsg.message}
                          </p>
                        ) : (
                          <p className="text-xs mt-0.5 text-[rgb(var(--text-muted))]">
                            👥 {group.membersCount} members
                          </p>
                        )}
                      </div>

                      {/* Unread Badge */}
                      {unreadCount > 0 && (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-black shadow-lg glow-green shrink-0">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Pin Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinGroup(id);
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

      {/* RESPONSIVE GROUP CHAT AREA - Mobile Optimized */}
      <div className={`flex-1 flex flex-col bg-[rgb(var(--bg-primary))] ${isChatOpen ? 'pb-0' : 'pb-16'} md:pb-0 overflow-hidden min-h-0`}>
        {selectedGroup ? (
          <>
            {/* CHAT HEADER - Mobile Optimized */}
            <div className="p-2 xs:p-3 sm:p-4 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between gap-1 xs:gap-2 sm:gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0 flex-1">
                {/* Back Button - Mobile Safe */}
                <button
                  onClick={() => {
                    setSelectedGroup(null);
                    setMessages([]);
                    setMembers([]);
                    setSidebarOpen(true);
                  }}
                  className="p-1.5 xs:p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-green-400 flex-shrink-0"
                  title="Back"
                >
                  <ChevronLeft className="w-4 xs:w-4.5 sm:w-5 h-4 xs:h-4.5 sm:h-5" />
                </button>

                {/* Group Info - Mobile Optimized */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 flex-wrap">
                    <h3 className="font-semibold text-[rgb(var(--text-primary))] text-xs xs:text-sm sm:text-base lg:text-lg truncate max-w-[180px] sm:max-w-none">
                      {selectedGroup.name}
                    </h3>
                    {String(selectedGroup?.adminId) === String(currentUserId) && (
                      <span className="text-green-400 text-xs font-bold bg-green-500/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-green-500/30 shadow-sm glow-green">
                        👑 Admin
                      </span>
                    )}
                  </div>
                  
                  {/* Mobile: Compact | Desktop: Full Info */}
                  <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-4 mt-0.5 xs:mt-1 text-xs sm:text-sm text-[rgb(var(--text-muted))] flex-wrap">
                    <p className="hidden sm:block text-xs">
                      Admin: <span className="text-green-400 font-bold glow-green">{adminInfo?.adminName || 'Loading...'}</span>
                    </p>
                    <p className={`font-medium text-xs sm:text-sm ${onlineCount > 0 ? 'text-green-400' : 'text-[rgb(var(--text-muted))]'}`}>
                      {onlineCount > 0 ? (
                        <>🟢 {onlineCount} · {members.length}</>
                      ) : (
                        <>🔴 {members.length}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Options Menu */}
              <div className="relative">
                <button 
                  data-menu-button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🔵 3-dot clicked');
                    setShowOptionsMenu(prev => !prev);
                  }}
                  className="p-1.5 xs:p-2 sm:p-3 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300 shrink-0 border border-red-500/30 hover:border-red-400/50"
                  title="Group Options"
                >
                  <MoreVertical className="w-4 xs:w-5 sm:w-6 h-4 xs:h-5 sm:h-6" />
                </button>

                {/* Dropdown Menu - MOBILE */}
                {showOptionsMenu && (
                  <div 
                    data-options-menu
                    className="absolute right-0 top-full mt-2 w-48 sm:w-52 bg-[rgb(var(--bg-secondary))] border-2 border-red-500/50 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Add Member - Admin Only */}
                    {String(selectedGroup?.adminId) === String(currentUserId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('✅ Add Member clicked');
                          setShowAddMemberModal(true);
                          setSearchUsersToAdd("");
                          setSelectedUsersToAdd([]);
                          setShowOptionsMenu(false);
                          fetchUsersToAdd();
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-green-500/20 text-xs sm:text-sm text-green-400 flex items-center gap-2 sm:gap-3 border-b border-[rgb(var(--border-secondary))] transition-all hover:border-green-500/30"
                      >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span className="font-semibold">Add Member</span>
                      </button>
                    )}

                    {/* View Members */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMembersPreview(true);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-blue-500/20 text-xs sm:text-sm text-blue-400 flex items-center gap-2 sm:gap-3 border-b border-[rgb(var(--border-secondary))] transition-all hover:border-blue-500/30"
                    >
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="font-semibold">Members ({members.length})</span>
                    </button>

                    {/* Leave Group */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeaveGroup();
                        setShowOptionsMenu(false);
                      }}
                      disabled={loading}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-amber-500/20 text-xs sm:text-sm text-amber-400 flex items-center gap-2 sm:gap-3 border-b border-[rgb(var(--border-secondary))] transition-all hover:border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="font-semibold">{loading ? "Leaving..." : "Leave"}</span>
                    </button>

                    {/* DELETE GROUP - ADMIN ONLY */}
                    {String(selectedGroup?.adminId) === String(currentUserId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(true);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-red-500/20 text-xs sm:text-sm text-red-400 flex items-center gap-2 sm:gap-3 transition-all hover:border-red-500/30"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span className="font-semibold">🗑️ Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ✅ RESPONSIVE MEMBERS PREVIEW */}
            {showMembersPreview && (
              <div className="p-3 sm:p-6 bg-linear-to-r from-[rgb(var(--bg-secondary))] to-[rgb(var(--bg-tertiary))]/30 border-b-2 border-green-500/20 max-h-72 overflow-y-auto custom-scrollbar flex-shrink-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-4 sticky top-0 bg-linear-to-r from-[rgb(var(--bg-secondary))] to-transparent pb-2 sm:pb-3 z-10">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-[rgb(var(--text-primary))]">
                      👥 Members ({members.length})
                    </h4>
                    <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5 sm:mt-1">
                      Admin: <span className="text-green-400 font-bold glow-green">{adminInfo?.adminName || 'N/A'}</span>
                    </p>
                  </div>
                  {String(selectedGroup?.adminId) === String(currentUserId) && (
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setSearchUsersToAdd("");
                        setSelectedUsersToAdd([]);
                        fetchUsersToAdd();
                      }}
                      className="px-3 sm:px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shadow-lg hover:shadow-green-500/50 glow-green shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                  )}
                </div>

                {/* Members List - NO EMAIL */}
                <div className="space-y-1 sm:space-y-2">
                  {members.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-[rgb(var(--text-muted))]">
                      <Users className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-1 sm:mb-2 opacity-30" />
                      <p className="text-xs sm:text-sm">No members</p>
                    </div>
                  ) : (
                    members.map((member) => {
                      if (!member || (!member._id && !member.userId)) {
                        console.warn('⚠️ Invalid member found:', member);
                        return null;
                      }

                      const memberId = member._id || member.userId;
                      const memberName = member.name || 'Unknown User';
                      const isOnline = groupOnlineMembers?.some(
                        u => (u.userId === memberId || u.userId === member._id || u.userId === member.userId)
                      );
                      
                      // ✅ CHECK IF THIS MEMBER IS ADMIN
                      const isAdmin = adminInfo?.adminId === memberId || 
                               adminInfo?.adminId?._id === memberId ||
                               selectedGroup?.adminId === memberId;
                      const isCurrentUser = memberId === currentUserId;

                      return (
                        <div
                          key={memberId}
                          className={`flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border transition-all group ${
                            isAdmin
                              ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 hover:border-green-500/50'
                              : 'bg-[rgb(var(--bg-hover))]/40 hover:bg-[rgb(var(--bg-hover))]/70 border-[rgb(var(--border-secondary))]/50 hover:border-green-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-xs sm:text-sm ${
                                isAdmin
                                  ? 'bg-linear-to-br from-green-500 to-emerald-700 glow-green'
                                  : 'bg-linear-to-br from-blue-500 to-purple-600'
                              }`}>
                                {memberName.charAt(0).toUpperCase()}
                              </div>
                              
                              {/* Online Indicator */}
                              <div className={`absolute bottom-0 right-0 w-2 h-2 sm:w-3 sm:h-3 border border-[rgb(var(--bg-secondary))] rounded-full transition-all ${
                                isOnline ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' : 'bg-[rgb(var(--text-muted))]'
                              }`}></div>
                              
                              {/* Admin Crown */}
                              {isAdmin && (
                                <div className="absolute -top-1 -right-1 text-lg sm:text-xl animate-bounce">👑</div>
                              )}
                            </div>

                            {/* Member Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-[rgb(var(--text-primary))] text-xs sm:text-sm truncate">
                                  {memberName}
                                  {isCurrentUser && <span className="text-blue-400 ml-1">(You)</span>}
                                </p>
                                
                                {/* Admin Badge */}
                                {isAdmin && (
                                  <span className="bg-green-500/30 border border-green-500/50 text-green-300 text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap glow-green">
                                    👑 Admin
                                  </span>
                                )}
                                
                                {/* Online Badge */}
                                {isOnline && (
                                  <span className="text-xs bg-green-500/20 text-green-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold whitespace-nowrap animate-pulse hidden sm:inline-block border border-green-500/30 shadow-sm shadow-green-500/20">
                                    ● Online
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remove Button - Only show if current user is admin */}
                            {String(selectedGroup?.adminId) === String(currentUserId) && memberId !== currentUserId && (
                              <button
                                onClick={() => handleRemoveMember(memberId)}
                                disabled={removeMemberLoading === memberId}
                                className="p-2 sm:p-2.5 rounded-lg transition-all shrink-0 font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-red-500/50 border border-red-400/50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove Member"
                              >
                                {removeMemberLoading === memberId ? (
                                  <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-white" />
                                ) : (
                                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white font-bold" />
                                )}
                              </button>
                            )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* MESSAGES AREA - Mobile Optimized */}
            <div className="flex-1 overflow-y-auto p-2 xs:p-2.5 sm:p-4 lg:p-6 space-y-1 xs:space-y-2 sm:space-y-4 custom-scrollbar min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 h-12 sm:w-12 border-b-2 border-green-500 mx-auto mb-2 sm:mb-3"></div>
                    <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))]">
                      Loading...
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--text-muted))]">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-3 sm:mb-4 md:mb-6 shadow-2xl">
                    <MessageCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500/50" />
                  </div>
                  <h3 className="text-sm sm:text-lg md:text-2xl font-bold mb-1 sm:mb-2 md:mb-3 gradient-text text-center">
                    {safeSelectedGroup.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] text-center max-w-xs">
                    No messages yet. Start!
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => renderMessage(msg, index))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA - Mobile Optimized */}
            <div className="p-2 xs:p-2.5 sm:p-4 bg-[rgb(var(--bg-secondary))] sm:glass-effect border-t border-[rgb(var(--border-secondary))] flex-shrink-0">
              {error && (
                <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs">
                  {error}
                </div>
              )}
              <div className="flex items-end gap-1 xs:gap-1.5 sm:gap-3">
                {/* Emoji & Attachment - Hidden on mobile */}
                <div className="hidden xs:flex gap-0.5 xs:gap-1">
                  <button className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-xl transition-all text-[rgb(var(--text-muted))] hover:text-green-400">
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>

                {/* Input Box - RESPONSIVE & THEME AWARE */}
                <div className="flex-1 rounded-2xl border border-[rgb(var(--border-secondary))]/60 bg-[rgb(var(--bg-tertiary))]/40 backdrop-blur-md focus-within:border-green-500/80 focus-within:ring-2 focus-within:ring-green-500/40 transition-all duration-200 hover:border-[rgb(var(--border-secondary))]/80">
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
                    placeholder="Message..."
                    rows={1}
                    className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-transparent text-sm sm:text-base md:text-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))]/70 resize-none focus:outline-none max-h-32 custom-scrollbar transition-colors"
                    style={{ minHeight: "44px" }}
                  />
                </div>

                {/* Send Button - RESPONSIVE */}
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`p-2 sm:p-3 rounded-xl transition-all shadow-lg shrink-0 ${
                    newMessage.trim()
                      ? "bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-black glow-green"
                      : "bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-muted))] cursor-not-allowed"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          // EMPTY STATE - Mobile Optimized
          <div className="flex-1 flex flex-col items-center justify-center text-[rgb(var(--text-muted))] p-3 xs:p-4 sm:p-6 min-h-0">
            <div className="w-16 xs:w-20 sm:w-24 md:w-32 h-16 xs:h-20 sm:h-24 md:h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-3 xs:mb-4 sm:mb-6 shadow-2xl">
              <Users className="w-8 xs:w-10 sm:w-12 md:w-16 h-8 xs:h-10 sm:h-12 md:h-16 text-green-500/50" />
            </div>
            <h3 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold mb-1 xs:mb-2 sm:mb-3 gradient-text text-center">
              Select a Group
            </h3>
            <p className="text-[rgb(var(--text-muted))] text-center text-xs sm:text-sm max-w-xs px-2">
              Choose from sidebar to chat
            </p>
          </div>
        )}
      </div>
      {/* ✅ CLOSE MAIN CONTENT WRAPPER */}
      </div>

      {/* ✅ CREATE GROUP MODAL - RESPONSIVE */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-[rgb(var(--border-secondary))]">
            {/* Modal Header */}
            <div className="p-3 sm:p-6 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between sticky top-0 bg-[rgb(var(--bg-secondary))]">
              <h3 className="text-base sm:text-xl font-bold text-[rgb(var(--text-primary))]">Create Group</h3>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setSearchUsers("");
                }}
                className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-6 space-y-4">
              {/* Group Name Input */}
              <div>
                <label className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-muted))] block mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="Enter name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent"
                />
              </div>

              {/* User Search */}
              <div>
                <label className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-muted))] block mb-2">
                  Add Members
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[rgb(var(--text-muted))]" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Members - RESPONSIVE */}
              {selectedMembers.length > 0 && (
                <div className="bg-[rgb(var(--bg-hover))]/30 rounded-lg p-2 sm:p-3">
                  <p className="text-xs text-[rgb(var(--text-muted))] mb-2 font-semibold">
                    Selected ({selectedMembers.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {selectedMembers.map((memberId) => {
                      const member = availableUsers.find(
                        (u) => (u.userId || u._id) === memberId
                      );
                      return (
                        <div
                          key={memberId}
                          className="bg-green-500/20 border border-green-500/30 text-green-300 px-2 sm:px-3 py-1 rounded-full text-xs flex items-center gap-1.5"
                        >
                          <span className="truncate">{member?.name}</span>
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
              <div className="space-y-1.5 sm:space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-6 text-[rgb(var(--text-muted))]">
                    <p className="text-xs sm:text-sm">
                      {searchUsers ? "Not found" : "Loading..."}
                    </p>
                  </div>
                ) : (
                  availableUsers
                    .filter((user) => {
                      const userStr = `${user.name} ${user.email}`.toLowerCase();
                      return userStr.includes(searchUsers.toLowerCase());
                    })
                    .map((user) => {
                      const userId = user._id || user.id;
                      const isSelected = selectedMembers.includes(userId);
                      const userName = user.name || user.email || 'Unknown';

                      return (
                        <button
                          key={userId}
                          onClick={() => toggleMemberSelection(userId)}
                          className={`w-full p-2 sm:p-3 rounded-lg text-left transition-all flex items-center gap-2 sm:gap-3 text-sm ${
                            isSelected
                              ? "bg-green-500/20 border border-green-500/30"
                              : "hover:bg-[rgb(var(--bg-hover))]/50 border border-[rgb(var(--border-secondary))]/50"
                          }`}
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0 shadow-lg">
                            {userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[rgb(var(--text-primary))] text-xs sm:text-sm truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-[rgb(var(--text-muted))] truncate">
                              {user.email}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-6 border-t border-[rgb(var(--border-secondary))] flex gap-2 sm:gap-3 sticky bottom-0 bg-[rgb(var(--bg-secondary))]">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                  setSearchUsers("");
                }}
                className="flex-1 px-3 sm:px-4 py-2 bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] text-sm rounded-lg hover:bg-[rgb(var(--bg-hover))]/70 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
                className={`flex-1 px-3 sm:px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold text-sm ${
                  !creatingGroup && groupName.trim() && selectedMembers.length > 0
                    ? "bg-linear-to-br from-green-600 to-emerald-700 text-black hover:from-green-500 hover:to-emerald-600 glow-green cursor-pointer"
                    : "bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-muted))] cursor-not-allowed opacity-50"
                }`}
              >
                {creatingGroup && <Loader className="w-4 h-4 animate-spin" />}
                {creatingGroup ? "Creating..." : `Create`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ DELETE CONFIRM - RESPONSIVE */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg border border-red-600 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-red-400 mb-2">Delete Group?</h3>
            <p className="text-sm text-slate-300 mb-4">
              This will permanently delete "{selectedGroup?.name}" and all messages. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
                disabled={deletingGroup}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                disabled={deletingGroup}
              >
                {deletingGroup ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ADD MEMBER MODAL - RESPONSIVE */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-lg border border-blue-600 p-6 max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-blue-400">Add Members</h3>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUsersToAdd([]);
                  setSearchUsersToAdd('');
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Search Box */}
            <input
              type="text"
              placeholder="Search friends..."
              value={searchUsersToAdd}
              onChange={(e) => setSearchUsersToAdd(e.target.value.toLowerCase())}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 mb-4"
            />

            {/* Users List - NO EMAIL */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 custom-scrollbar">
              {addMemberLoading ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading friends...</p>
              ) : usersToAddList.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  All your friends are already in this group! 🎉
                </p>
              ) : (
                usersToAddList
                  .filter(user => 
                    (user.name || '').toLowerCase().includes(searchUsersToAdd)
                  )
                  .map((user) => {
                    const userId = user._id || user.id;
                    const isSelected = selectedUsersToAdd.includes(userId);

                    return (
                      <label
                        key={userId}
                        className="flex items-center gap-3 p-2 rounded hover:bg-slate-700 cursor-pointer transition-colors"
                        title={user.name}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedUsersToAdd(prev =>
                              prev.includes(userId)
                                ? prev.filter(id => id !== userId)
                                : [...prev, userId]
                            );
                          }}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.name}</p>
                        </div>
                      </label>
                    );
                  })
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUsersToAdd([]);
                  setSearchUsersToAdd('');
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
                disabled={addMemberLoading}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedUsersToAdd.length === 0) {
                    alert('Please select at least one member');
                    return;
                  }

                  try {
                    setAddMemberLoading(true);
                    const groupId = selectedGroup._id || selectedGroup.id;

                    // ✅ Add each selected user
                    for (const userId of selectedUsersToAdd) {
                      console.log(`➕ Adding user ${userId} to group ${groupId}`);
                      await groupService.addMember(groupId, userId);
                    }

                    // ✅ IMMEDIATELY REFRESH GROUP DATA
                    console.log('🔄 Refreshing group data...');
                    const updatedGroupResponse = await groupService.getGroup(groupId);
                    
                    console.log('✅ Updated group:', updatedGroupResponse);
                    
                    // ✅ Updated members list
                    const updatedMembers = updatedGroupResponse.members || updatedGroupResponse.participants || [];
                    
                    // ✅ Update state immediately
                    setMembers(updatedMembers);
                    setSelectedGroup(prev => ({
                      ...prev,
                      members: updatedMembers,
                      participants: updatedMembers
                    }));
                    
                    // ✅ Update groups list count
                    setGroups(prevGroups =>
                      prevGroups.map(g =>
                        (g._id || g.id) === groupId
                          ? { ...g, membersCount: updatedMembers.length }
                          : g
                      )
                    );

                    setShowAddMemberModal(false);
                    setSelectedUsersToAdd([]);
                    setSearchUsersToAdd('');
                    alert(`✅ Added ${selectedUsersToAdd.length} member(s) successfully!`);
                    console.log(`✅ Added ${selectedUsersToAdd.length} members`);
                    
                  } catch (err) {
                    console.error('Add members error:', err);
                    const errorMsg = err.response?.data?.message || err.message || 'Failed to add members';
                    setError(errorMsg);
                    alert('❌ ' + errorMsg);
                  } finally {
                    setAddMemberLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                disabled={addMemberLoading || selectedUsersToAdd.length === 0}
              >
                {addMemberLoading ? 'Adding...' : `Add (${selectedUsersToAdd.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

