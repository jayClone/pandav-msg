
    import React, { useEffect, useMemo, useState, useRef } from "react";
    import { SOCKET_EVENTS } from "@constants/socketEvents.js";
    import { connectSocket, disconnectSocket, getSocket } from "@socket/socketClient.js";
    import { useNavigate } from "react-router-dom";
    import { jwtDecode } from "jwt-decode";
    import groupService from "@services/group.service.js";
    import {
      MessageCircle,
      Send,
      LogOut,
      Users,
      Search,
      MoreVertical,
      Circle,
      Settings,
      Volume2,
      VolumeX,
      Pin,
      Smile,
      Paperclip,
      X
    } from "lucide-react";

export default function GroupChat() {

      // =====================
      // State Declarations
      // =====================
      const navigate = useNavigate();
      const messagesEndRef = useRef(null);
      const messageInputRef = useRef(null);
      const fileInputRef = useRef(null);

      // Group creation modal state
      const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
      const [newGroupName, setNewGroupName] = useState("");
      const [selectedPeople, setSelectedPeople] = useState([]);
      const [allPeople, setAllPeople] = useState([]); // All users for selection

      // Main chat state
      const [groups, setGroups] = useState([]);
      const [selectedGroupId, setSelectedGroupId] = useState("");
      const [messageInput, setMessageInput] = useState("");
      const [messages, setMessages] = useState([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState("");
      const [searchQuery, setSearchQuery] = useState("");
      const [showSettings, setShowSettings] = useState(false);
      const [soundEnabled, setSoundEnabled] = useState(true);
      const [notificationsEnabled, setNotificationsEnabled] = useState(true);
      const [pinnedGroups, setPinnedGroups] = useState([]);
      const [showEmojiPicker, setShowEmojiPicker] = useState(false);
      const [replyingTo, setReplyingTo] = useState(null);
      const [showMembersModal, setShowMembersModal] = useState(false);
      const [groupMembers, setGroupMembers] = useState([]);
      const [isGroupAdmin, setIsGroupAdmin] = useState(false);

      // =====================
      // Auth State
      // =====================
      const token = useMemo(() => localStorage.getItem("token"), []);
      const authState = useMemo(() => {
        if (!token) return { currentUserName: "", currentUserId: "" };
        try {
          const decoded = jwtDecode(token);
          return {
            currentUserName: decoded.name,
            currentUserId: decoded.userId,
          };
        } catch {
          return { currentUserName: "", currentUserId: "" };
        }
      }, [token]);
      const { currentUserName, currentUserId } = authState;

      // =====================
      // Effects
      // =====================

      // Fetch all groups on component mount
      useEffect(() => {
        fetchAllGroups();
      }, []);

      // Fetch all people (online users for now, can be replaced with all users from backend)
      useEffect(() => {
        if (!showCreateGroupModal) return;
        
        const fetchAllUsers = async () => {
          try {
            const response = await fetch('http://localhost:5000/api/v1/users', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              const users = Array.isArray(data) ? data : (data.users || data.data || []);
              setAllPeople(users);
            }
          } catch (err) {
            console.error("Failed to fetch users:", err);
          }
        };
        
        const socket = getSocket && getSocket();
        if (socket) {
          const handleOnlineUsers = (users) => setAllPeople(users || []);
          socket.on && socket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
          socket.emit && socket.emit(SOCKET_EVENTS.ONLINE_USERS);
          return () => {
            socket.off && socket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
          };
        } else {
          fetchAllUsers();
        }
      }, [showCreateGroupModal, token]);

      // Request notification permission
      useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      }, []);

      // Auto-scroll to bottom when new messages arrive
      useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

      // Socket connection effect (group chat events)
      useEffect(() => {
        if (!token) {
          navigate("/login");
          return;
        }
        let socket = connectSocket(token);
        if (!socket) return;
        const handleGroups = (groups) => setGroups(groups || []);
        const handleGroupMessage = (data) => {
          setMessages((prev) => [...prev, data]);
          playNotificationSound();
        };
        socket.on(SOCKET_EVENTS.GROUPS, handleGroups);
        socket.on(SOCKET_EVENTS.GROUP_MESSAGE, handleGroupMessage);
        return () => {
          socket.off(SOCKET_EVENTS.GROUPS, handleGroups);
          socket.off(SOCKET_EVENTS.GROUP_MESSAGE, handleGroupMessage);
        };
      }, [token, navigate, selectedGroupId]);

      // Fetch group chat history when group is selected
      useEffect(() => {
        if (selectedGroupId) {
          fetchGroupChatHistory(selectedGroupId);
          messageInputRef.current?.focus();
        }
      }, [selectedGroupId]);

      // =====================
      // Handlers
      // =====================

      // Play notification sound
      const playNotificationSound = () => {
        if (soundEnabled) {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKnn77BXGwU7k9n1xnMpBSh+zPLaizsKGGS56+mnUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJGGS56+inTxILTKXh8bllHAU1jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBSl+zO/ajDsJF2S56+mmUBELTKXh8bllHAU2jdXzzn0vBQ==');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }
      };

      // Handle person selection in group creation
      const togglePerson = (userId) => {
        setSelectedPeople((prev) =>
          prev.includes(userId)
            ? prev.filter((id) => id !== userId)
            : [...prev, userId]
        );
      };

      // Handle group creation (replace with actual API call)
      const handleCreateGroup = async () => {
        if (!newGroupName.trim() || selectedPeople.length === 0) {
          setError("Group name and at least one participant are required");
          setTimeout(() => setError(""), 3000);
          return;
        }
        
        if (!currentUserId) {
          console.error("❌ currentUserId is missing:", { currentUserId, currentUserName, token: !!token });
          setError("User ID not found. Please login again.");
          setTimeout(() => setError(""), 3000);
          return;
        }
        
        try {
          setLoading(true);
          
          // Log the raw data before processing
          console.log("🔍 Before processing:", {
            currentUserId,
            currentUserIdType: typeof currentUserId,
            selectedPeople,
            selectedPeopleTypes: selectedPeople.map(id => `${typeof id}: ${id}`)
          });
          
          // Include the current user (admin/creator) in the participants list
          const participantIds = [...new Set([currentUserId, ...selectedPeople])]; // Ensure no duplicates
          
          console.log("📋 Group Details:", {
            groupName: newGroupName.trim(),
            currentUserId: currentUserId,
            selectedPeople: selectedPeople,
            allParticipantIds: participantIds,
            participantCount: participantIds.length,
            hasValidMembers: participantIds.length > 0,
            memberDetails: participantIds.map((id, idx) => `[${idx}]: ${typeof id} = "${id}"`)
          });
          
          if (participantIds.length === 0) {
            throw new Error('No members to add to group');
          }
          
          // Final validation before sending
          const allValidIds = participantIds.every(id => id && typeof id === 'string' && id.trim() !== '');
          console.log("✅ All IDs valid:", allValidIds);
          
          const createdGroup = await groupService.createGroup(newGroupName.trim(), participantIds);
          console.log("✅ Group created successfully:", createdGroup);
          
          // Add new group to list
          setGroups((prev) => [...prev, createdGroup]);
          
          // Close modal and reset form
          setShowCreateGroupModal(false);
          setNewGroupName("");
          setSelectedPeople([]);
          
          // Select the newly created group
          setSelectedGroupId(createdGroup._id);
          
          setError("");
        } catch (err) {
          console.error("❌ Failed to create group:", err);
          console.error("Error message:", err.message);
          setError(err.message || "Failed to create group");
          setTimeout(() => setError(""), 5000);
        } finally {
          setLoading(false);
        }
      };

      // Fetch all groups
      const fetchAllGroups = async () => {
        try {
          console.log("📤 Fetching all groups...");
          const data = await groupService.getMyGroups();
          console.log("📥 Raw response:", data);
          
          // Handle different response formats
          const groupsArray = Array.isArray(data) ? data : (data.groups || data.data || []);
          console.log("✅ Groups to set:", groupsArray);
          
          setGroups(groupsArray);
        } catch (err) {
          console.error("❌ Failed to fetch groups:", err);
          setError(err.message || "Failed to fetch groups");
        }
      };

      // Fetch group chat history
      const fetchGroupChatHistory = async (groupId) => {
        setLoading(true);
        setError("");
        setMessages([]);
        try {
          const data = await groupService.getGroupMessages(groupId);
          console.log("✅ Fetched group messages:", data);
          
          // Handle different response formats
          const messagesArray = Array.isArray(data) ? data : (data.messages || data.data || []);
          
          const messagesWithIds = messagesArray.map(msg => ({
            _id: msg._id,
            groupId: msg.groupId,
            fromUserId: msg.userId,
            fromUserName: msg.senderName || "Unknown",
            message: msg.message,
            time: msg.createdAt,
            read: msg.read
          }));
          
          setMessages(messagesWithIds);
          
          // Fetch group details to get members and check if current user is admin
          const groupData = groups.find(g => g._id === groupId);
          if (groupData) {
            console.log("✅ Group data:", groupData);
            setGroupMembers(groupData.members || []);
            
            // Check if current user is admin (creator)
            const isAdmin = groupData.createdBy === currentUserId || groupData.admin === currentUserId;
            setIsGroupAdmin(isAdmin);
            console.log("👤 Is admin:", isAdmin, "Created by:", groupData.createdBy);
          }
        } catch (err) {
          console.error("Failed to fetch group messages:", err);
          setError(err.message || "Failed to fetch group messages");
          setMessages([]);
        } finally {
          setLoading(false);
        }
      };

      // Send message handler
      const handleSendMessage = () => {
        const socket = getSocket();
        if (!socket) {
          setError("Socket not connected");
          setTimeout(() => setError(""), 3000);
          return;
        }
        if (!selectedGroupId) {
          setError("Select a group first");
          setTimeout(() => setError(""), 3000);
          return;
        }
        if (!messageInput.trim()) return;
        const messageText = messageInput.trim();
        socket.emit(SOCKET_EVENTS.GROUP_MESSAGE, {
          groupId: selectedGroupId,
          message: messageText,
        });
        setMessageInput("");
        setReplyingTo(null);
      };

      // Logout handler
      const handleLogout = () => {
        localStorage.removeItem("token");
        disconnectSocket();
        navigate("/login");
      };

      // Remove member from group
      const handleRemoveMember = async (memberId) => {
        if (!isGroupAdmin) {
          setError("Only admins can remove members");
          setTimeout(() => setError(""), 3000);
          return;
        }

        if (memberId === currentUserId) {
          setError("You cannot remove yourself from the group");
          setTimeout(() => setError(""), 3000);
          return;
        }

        try {
          console.log("🗑️ Removing member:", memberId, "from group:", selectedGroupId);
          await groupService.removeMember(selectedGroupId, memberId);
          
          // Update group members locally
          setGroupMembers(prev => prev.filter(m => m._id !== memberId && m.userId !== memberId));
          
          // Update groups list
          setGroups(prev => 
            prev.map(g => 
              g._id === selectedGroupId 
                ? { ...g, members: g.members.filter(m => m._id !== memberId && m.userId !== memberId) }
                : g
            )
          );
          
          console.log("✅ Member removed successfully");
        } catch (err) {
          console.error("Failed to remove member:", err);
          setError(err.message || "Failed to remove member");
          setTimeout(() => setError(""), 3000);
        }
      };

      // Pin/unpin group
      const togglePinGroup = (groupId) => {
        setPinnedGroups((prev) =>
          prev.includes(groupId)
            ? prev.filter((id) => id !== groupId)
            : [...prev, groupId]
        );
      };

      // =====================
      // Utility Functions
      // =====================

      const getDisplayName = (groupId) => {
        const group = groups.find((g) => g._id === groupId);
        return group?.name || groupId;
      };

      const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      };

      // =====================
      // Derived Data
      // =====================

      const filteredGroups = groups
        .filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
          const aIsPinned = pinnedGroups.includes(a._id);
          const bIsPinned = pinnedGroups.includes(b._id);
          if (aIsPinned && !bIsPinned) return -1;
          if (!aIsPinned && bIsPinned) return 1;
          return 0;
        });

      const currentGroupMessages = messages.filter((m) => m.groupId === selectedGroupId);
      const commonEmojis = ["😊", "👍", "❤️", "😂", "🎉", "🔥", "✅", "👏", "🙏", "💯"];

    return (
        <div className="flex h-screen bg-[rgb(var(--bg-primary))]">
            {/* Create Group Modal */}
            {showCreateGroupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-in fade-in slide-in-from-top-4">
                        <button
                            className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-400"
                            onClick={() => setShowCreateGroupModal(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Create New Group</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                placeholder="Enter group name"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Add People</label>
                            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 space-y-1">
                                {allPeople.length === 0 ? (
                                    <div className="text-gray-400 text-sm text-center py-6">No users available online</div>
                                ) : (
                                    allPeople.map(person => (
                                        <label key={person.userId} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-green-100 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={selectedPeople.includes(person.userId)}
                                                onChange={() => togglePerson(person.userId)}
                                                className="w-4 h-4 accent-green-600 rounded cursor-pointer"
                                            />
                                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                                                {person.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 truncate">{person.name}</p>
                                                <p className="text-xs text-green-600 font-semibold">● Online</p>
                                            </div>
                                            {selectedPeople.includes(person.userId) && (
                                                <div className="text-green-600 font-bold">✓</div>
                                            )}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        {/* Preview */}
                        <div className="mb-4">
                            <div className="text-xs text-gray-500 mb-2">Preview</div>
                            <div className="p-4 rounded-lg bg-gray-100 border border-gray-200">
                                <div className="font-semibold text-green-700 mb-3">{newGroupName || <span className="text-gray-400">Group name...</span>}</div>
                                <div className="space-y-3">
                                    <div className="text-xs text-gray-600 font-medium">
                                        Members ({selectedPeople.length + 1})
                                    </div>
                                    {selectedPeople.length === 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            <div 
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-green-300 shadow-sm"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {currentUserName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{currentUserName}</span>
                                                <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">Admin</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            <div 
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-green-300 shadow-sm"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {currentUserName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{currentUserName}</span>
                                                <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">Admin</span>
                                            </div>
                                            {allPeople.filter(p => selectedPeople.includes(p.userId)).map(person => (
                                                <div 
                                                    key={person.userId}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-green-200 shadow-sm hover:shadow-md transition-all"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                                                        {person.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">{person.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            className={`w-full py-2 rounded-lg font-bold text-white transition-all ${newGroupName.trim() && selectedPeople.length ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
                            disabled={!newGroupName.trim() || selectedPeople.length === 0}
                            onClick={handleCreateGroup}
                        >
                            Create Group
                        </button>
                    </div>
                </div>
            )}

            {/* Members Modal */}
            {showMembersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-in fade-in slide-in-from-top-4">
                        <button
                            className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-400"
                            onClick={() => setShowMembersModal(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Group Members</h2>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {groupMembers.length === 0 ? (
                                <div className="text-center text-gray-400 py-8">
                                    <p>No members yet</p>
                                </div>
                            ) : (
                                groupMembers.map((member) => {
                                    const memberId = member._id || member.userId;
                                    const memberName = member.name || member.userName || "Unknown";
                                    const isCurrentUser = memberId === currentUserId;
                                    const isAdmin = member.isAdmin || member.role === "admin";
                                    
                                    return (
                                        <div
                                            key={memberId}
                                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                                                    {memberName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 truncate">
                                                        {memberName} {isCurrentUser && "(You)"}
                                                    </p>
                                                    {isAdmin && (
                                                        <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">Admin</span>
                                                    )}
                                                </div>
                                            </div>
                                            {isGroupAdmin && !isCurrentUser && (
                                                <button
                                                    onClick={() => handleRemoveMember(memberId)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
                                                    title="Remove member"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Sidebar - Groups List */}
            <div className="w-80 glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col">
                {/* Header */}
                <div className="p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-black font-bold glow-green">
                                    {currentUserName.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[rgb(var(--bg-secondary))] rounded-full pulse-glow"></div>
                            </div>
                            <div>
                                <h2 className="text-black font-semibold">{currentUserName}</h2>
                                <p className="text-xs text-green-400 flex items-center gap-1 font-medium">
                                    <Circle className="w-2 h-2 fill-current animate-pulse" />
                                    Active Now
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
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
                                    className={`w-10 h-6 rounded-full transition-all ${soundEnabled ? 'bg-green-500' : 'bg-gray-600'} relative`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${soundEnabled ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400 flex items-center gap-2">
                                    {notificationsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                    Notifications
                                </span>
                                <button
                                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                    className={`w-10 h-6 rounded-full transition-all ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-600'} relative`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all"
                        />
                    </div>
                    {/* Navigation Tabs */}
                    <div className="flex gap-2 mt-3 px-1 items-center">
                        <button
                            onClick={() => navigate("/chat")}
                            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-all shadow-md"
                            title="Go to User Chat"
                        >
                            Chat
                        </button>
                        <button className="flex-1 px-4 py-2 bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-lg font-medium text-sm transition-all hover:from-green-500 hover:to-emerald-600 shadow-md glow-green">
                            Groups
                        </button>
                        <button
                            onClick={() => setShowCreateGroupModal(true)}
                            className="ml-2 p-2 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-md flex items-center justify-center transition-all"
                            title="Create Group"
                        >
                            <span className="text-lg font-bold">+</span>
                        </button>
                    </div>
                </div>
                {/* Groups List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Groups ({filteredGroups.length})
                    </div>
                    {filteredGroups.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No active groups</p>
                            <p className="text-xs text-gray-600 mt-1">Create or join a group!</p>
                        </div>
                    ) : (
                        filteredGroups.map((group) => {
                            const isPinned = pinnedGroups.includes(group._id);
                            return (
                                <div
                                    key={group._id}
                                    className={`group relative p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all ${selectedGroupId === group._id ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green" : "hover:bg-[rgb(var(--bg-hover))]/50"}`}
                                >
                                    <div onClick={() => setSelectedGroupId(group._id)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-black font-bold text-lg shadow-lg">
                                                        {group.name.charAt(0).toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-semibold truncate text-black">{group.name}</div>
                                                        {isPinned && <Pin className="w-3 h-3 text-green-400 shrink-0" />}
                                                    </div>
                                                    <div className={`text-xs ${selectedGroupId === group._id ? 'text-green-300' : 'text-gray-500'}`}>Group Chat</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Pin button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePinGroup(group._id);
                                        }}
                                        className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isPinned ? 'text-green-400 bg-green-500/20' : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))] hover:text-green-400'}`}
                                        title={isPinned ? "Unpin" : "Pin"}
                                    >
                                        <Pin className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            {/* Main Group Chat Area */}
            <div className="flex-1 flex flex-col bg-[rgb(var(--bg-primary))]">
                {selectedGroupId ? (
                    <>
                        {/* Group Chat Header */}
                        <div className="p-4 glass-effect border-b border-[rgb(var(--border-secondary))]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-11 h-11 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-black font-bold shadow-lg glow-green">
                                            {getDisplayName(selectedGroupId).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-md">
                                            {groups.find((g) => g._id === selectedGroupId)?.members?.length || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-black text-lg">{getDisplayName(selectedGroupId)}</h3>
                                            <span className="text-xs bg-green-600/20 text-green-600 px-2 py-1 rounded-full font-semibold border border-green-400/30">Group</span>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Users className="w-3 h-3" />
                                            {groupMembers.length || 0} members
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setShowMembersModal(true)}
                                        className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400"
                                        title="View all members"
                                    >
                                        <Users className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-green-400">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            
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
                            ) : currentGroupMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <div className="w-24 h-24 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-lg">
                                        <MessageCircle className="w-12 h-12 text-green-500/50" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2 gradient-text">Start a Group Conversation</h3>
                                    <p className="text-gray-500 text-center max-w-md">
                                        Send a message to the group and start chatting!
                                    </p>
                                </div>
                            ) : (
                                currentGroupMessages.map((m, index) => {
                                    const isOwn = m.fromUserId === currentUserId;
                                    const showAvatar = index === 0 || currentGroupMessages[index - 1].fromUserId !== m.fromUserId;
                                    return (
                                        <div
                                            key={m._id || index}
                                            className={`flex gap-3 ${isOwn ? "flex-row-reverse message-right" : "flex-row message-left"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                        >
                                            {showAvatar ? (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${isOwn ? "bg-linear-to-br from-blue-500 to-blue-600" : "bg-linear-to-br from-indigo-500 to-purple-600"}`}>
                                                    {(isOwn ? currentUserName : m.fromUserName).charAt(0).toUpperCase()}
                                                </div>
                                            ) : (
                                                <div className="w-8"></div>
                                            )}
                                            <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
                                                {showAvatar && !isOwn && (
                                                    <span className="text-xs text-purple-400 mb-1 ml-2 font-medium">{m.fromUserName}</span>
                                                )}
                                                <div className={`relative group/message ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                                                    <div
                                                        className={`px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-sm transition-all ${isOwn ? "bg-linear-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm" : "bg-linear-to-br from-indigo-500/20 to-purple-600/20 text-gray-100 rounded-tl-sm border border-indigo-400/30"} ${m.sending ? 'opacity-70' : 'opacity-100'}`}
                                                    >
                                                        <p className="wrap-break-word leading-relaxed">{m.message}</p>
                                                    </div>
                                                    <div className={`flex items-center gap-2 mt-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                                                        <span className="text-xs text-gray-500 font-medium">{formatTime(m.time)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
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
                                                    setMessageInput((prev) => prev + emoji);
                                                    setShowEmojiPicker(false);
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
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Type your message..."
                                        rows="1"
                                        className="w-full px-4 py-3 bg-transparent text-black placeholder-gray-500 resize-none focus:outline-none max-h-32 custom-scrollbar"
                                        style={{ minHeight: "48px" }}
                                    />
                                </div>
                                {/* Send Button */}
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim()}
                                    className={`p-3 rounded-xl transition-all shadow-lg ${messageInput.trim() ? "bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-black glow-green" : "bg-[rgb(var(--bg-tertiary))] text-gray-500 cursor-not-allowed"}`}
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
                        <h3 className="text-3xl font-bold mb-3 gradient-text">Welcome to Group Chat</h3>
                        <p className="text-gray-500 text-center max-w-md mb-6">
                            Select a group from the sidebar to start messaging
                        </p>
                        <div className="flex gap-3">
                            <div className="px-4 py-2 glass-effect rounded-lg text-sm text-gray-400">
                                ⚡ Real-time group messaging
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
