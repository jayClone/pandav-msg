import { useState, useEffect, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode'
import groupService from '@services/group.service'
import messageService from '@services/message.service'
import API from '@api/axios.js'
import { LogOut, Users, Search, Plus, Trash2, X, ChevronDown, Check, CheckCheck } from 'lucide-react'

const GroupChat = () => {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showMembersPreview, setShowMembersPreview] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingAddMember, setLoadingAddMember] = useState(false)
  const [loadingRemoveMember, setLoadingRemoveMember] = useState(null)
  
  // Create group states
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loadingCreateGroup, setLoadingCreateGroup] = useState(false)
  const [createGroupSearch, setCreateGroupSearch] = useState('')
  const [filteredCreateUsers, setFilteredCreateUsers] = useState([])
  const [expandedMessageId, setExpandedMessageId] = useState(null)
  const [messageReadReceipts, setMessageReadReceipts] = useState({})

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

  // Mark message as read when viewing
  const markMessageAsRead = useCallback(async (messageId) => {
    if (!messageId || !selectedGroup) return

    try {
      // Mark as read in backend
      await messageService.markGroupMessagesAsRead(selectedGroup._id)
      
      // Update local read receipts state
      setMessageReadReceipts((prev) => ({
        ...prev,
        [messageId]: {
          isRead: true,
          readers: members.map(m => ({ userId: m._id, name: m.name }))
        }
      }))
    } catch (err) {
      console.error('Error marking message as read:', err)
    }
  }, [selectedGroup, members])

  // Get read receipt info for a message
  const getMessageReadInfo = useCallback((messageId) => {
    // For now, show all group members as readers (after implementing backend read tracking)
    // When backend implements readBy array, we'll use that data
    const readersCount = members.length - 1 // Exclude sender
    const readers = members.filter(m => m._id !== currentUserId)
    
    return {
      totalRecipients: readers.length,
      readers: readers,
      isRead: messageReadReceipts[messageId]?.isRead || false
    }
  }, [members, currentUserId, messageReadReceipts])

  // Fetch all groups on component mount
  useEffect(() => {
    fetchGroups()
  }, [])

  // Auto-mark messages as read when viewing group
  useEffect(() => {
    if (selectedGroup && messages.length > 0) {
      // Automatically mark all messages as read after a short delay
      const timer = setTimeout(() => {
        markMessageAsRead(messages[messages.length - 1]?._id)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [selectedGroup, messages, markMessageAsRead])

  // Fetch available users when add member form is opened
  useEffect(() => {
    if (showAddMember && selectedGroup) {
      fetchAvailableUsers()
    }
  }, [showAddMember, selectedGroup])

  // Fetch all users when create group form is opened
  useEffect(() => {
    if (showCreateGroup) {
      fetchAllUsersForCreation()
    }
  }, [showCreateGroup])

  // Filter users for create group form
  useEffect(() => {
    if (!createGroupSearch.trim()) {
      setFilteredCreateUsers(allUsers)
      return
    }

    const query = createGroupSearch.toLowerCase()
    const filtered = allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
    setFilteredCreateUsers(filtered)
  }, [createGroupSearch, allUsers])

  // Filter users based on search query and exclude already added members
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(availableUsers)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = availableUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, availableUsers])

  // Fetch all groups on component mount
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages(selectedGroup._id)
      setMembers(selectedGroup.members || [])
    }
  }, [selectedGroup])

  const fetchGroups = useCallback(async () => {
    try {
      setLoadingGroups(true)
      setError(null)
      const groupsData = await groupService.getMyGroups()
      setGroups(groupsData)
    } catch (err) {
      setError(err.message || 'Failed to fetch groups')
      console.error('Error fetching groups:', err)
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  const fetchAvailableUsers = useCallback(async (membersToFilter) => {
    try {
      setLoadingUsers(true)
      setError(null)
      const response = await API.get('/users')
      const allUsers = response.data.data || []

      // Filter out already added members (use passed members or state)
      const currentMembers = membersToFilter || members
      const memberIds = new Set(currentMembers.map((m) => m._id))

      const availableForAdd = allUsers.filter(
        (user) => !memberIds.has(user._id) && user._id !== currentUserId
      )

      setAvailableUsers(availableForAdd)
      setFilteredUsers(availableForAdd)
    } catch (err) {
      setError(err.message || 'Failed to fetch available users')
      console.error('Error fetching available users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }, [members, currentUserId])

  const fetchGroupMessages = useCallback(async (groupId) => {
    try {
      setLoadingMessages(true)
      setError(null)
      const messageData = await groupService.getGroupMessages(groupId)
      setMessages(messageData.messages || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch messages')
      console.error('Error fetching messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const fetchAllUsersForCreation = async () => {
    try {
      setLoadingUsers(true)
      setError(null)
      const response = await API.get('/users')
      const users = response.data.data || []

      // Filter out current user
      const filteredUsers = users.filter((user) => user._id !== currentUserId)

      setAllUsers(filteredUsers)
      setFilteredCreateUsers(filteredUsers)
    } catch (err) {
      setError(err.message || 'Failed to fetch users')
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSelectGroup = useCallback(async (group) => {
    try {
      setLoading(true)
      setError(null)
      const groupDetail = await groupService.getGroup(group._id)
      setSelectedGroup(groupDetail)
      setShowAddMember(false)
      setSearchQuery('')
      setSelectedUserId(null)
    } catch (err) {
      setError(err.message || 'Failed to fetch group details')
      console.error('Error fetching group details:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAddMember = useCallback(async () => {
    if (!selectedGroup || !selectedGroup._id) {
      setError('Group not found')
      return
    }
    if (!selectedUserId) {
      setError('Please select a member to add')
      return
    }

    const selectedUser = availableUsers.find((u) => u._id === selectedUserId)
    if (!selectedUser) {
      setError('Selected user not found')
      return
    }

    try {
      setLoadingAddMember(true)
      setError(null)
      console.log('handleAddMember:', { groupId: selectedGroup._id, memberId: selectedUserId })
      
      const response = await groupService.addMember(selectedGroup._id, selectedUserId)
      const updatedMembers = response.members || response.participants || []
      
      setSearchQuery('')
      setSelectedUserId(null)
      setShowAddMember(false)
      
      // Use response from addMember which has transformed 'members' field
      setSelectedGroup(response)
      setMembers(updatedMembers)
      // Pass updated members to avoid closure issues
      await fetchAvailableUsers(updatedMembers)
    } catch (err) {
      console.error('handleAddMember error:', err.message || err)
      setError(err.message || 'Failed to add member')
    } finally {
      setLoadingAddMember(false)
    }
  }, [selectedGroup, selectedUserId, availableUsers, fetchAvailableUsers])

  const handleRemoveMember = useCallback(async (memberId) => {
    if (!selectedGroup || !selectedGroup._id) {
      setError('Group not found')
      return
    }
    if (!memberId) {
      setError('Member not found')
      return
    }

    try {
      setLoadingRemoveMember(memberId)
      setError(null)
      
      // Optimistic update: remove member from local state immediately
      const updatedMembersOptimistic = members.filter((m) => m._id !== memberId)
      setMembers(updatedMembersOptimistic)
      
      console.log('handleRemoveMember:', { groupId: selectedGroup._id, memberId })
      
      const response = await groupService.removeMember(selectedGroup._id, memberId)
      const updatedMembers = response.members || response.participants || []
      
      // Update with backend response to ensure consistency
      setSelectedGroup(response)
      setMembers(updatedMembers)
      
      // Fetch available users with updated members list
      await fetchAvailableUsers(updatedMembers)
    } catch (err) {
      console.error('handleRemoveMember error:', err.message || err)
      setError(err.message || 'Failed to remove member')
      // Revert optimistic update on error
      setMembers(selectedGroup.members || [])
    } finally {
      setLoadingRemoveMember(null)
    }
  }, [selectedGroup, members, fetchAvailableUsers])

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedGroup) return

    try {
      setLoading(true)
      setError(null)
      await messageService.sendGroupMessage(selectedGroup._id, newMessage.trim())
      setNewMessage('')
      await fetchGroupMessages(selectedGroup._id)
    } catch (err) {
      setError(err.message || 'Failed to send message')
      console.error('Error sending message:', err)
    } finally {
      setLoading(false)
    }
  }, [newMessage, selectedGroup, fetchGroupMessages])

  const closeAddMemberForm = useCallback(() => {
    setShowAddMember(false)
    setSearchQuery('')
    setSelectedUserId(null)
    setError(null)
  }, [])

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim()) {
      setError('Group name is required')
      return
    }

    if (selectedMemberIds.length === 0) {
      setError('Please select at least one member')
      return
    }

    try {
      setLoadingCreateGroup(true)
      setError(null)

      await groupService.createGroup(groupName.trim(), selectedMemberIds)

      setGroupName('')
      setSelectedMemberIds([])
      setCreateGroupSearch('')
      setShowCreateGroup(false)

      await fetchGroups()
    } catch (err) {
      setError(err.message || 'Failed to create group')
      console.error('Error creating group:', err)
    } finally {
      setLoadingCreateGroup(false)
    }
  }, [groupName, selectedMemberIds, fetchGroups])

  const toggleMemberSelection = useCallback((userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }, [])

  const closeCreateGroupForm = useCallback(() => {
    setShowCreateGroup(false)
    setGroupName('')
    setSelectedMemberIds([])
    setCreateGroupSearch('')
    setError(null)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  const handleLeaveGroup = useCallback(async () => {
    if (!selectedGroup || !selectedGroup._id) {
      setError('Group not found')
      console.error('handleLeaveGroup: No selected group')
      return
    }

    // Show confirmation dialog
    const confirmLeave = window.confirm(
      `Are you sure you want to leave "${selectedGroup.name}"?\n\nYou will no longer see messages from this group.`
    )
    if (!confirmLeave) {
      console.log('User cancelled leaving group')
      return
    }

    try {
      setLoading(true)
      setError(null)
      console.log('Attempting to leave group:', selectedGroup._id)
      
      // Call the service method
      await groupService.leaveGroup(selectedGroup._id)
      
      console.log('Successfully left group')
      
      // Clear the selected group and refresh the groups list
      setSelectedGroup(null)
      setMessages([])
      setMembers([])
      setNewMessage('')
      
      // Refresh groups list to remove the left group
      await fetchGroups()
      
      // Show success message
      alert('You have successfully left the group')
    } catch (err) {
      console.error('Error leaving group:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        data: err.response?.data
      })
      
      // Handle different error scenarios
      if (err.response?.status === 404) {
        setError('Group not found or backend route not implemented yet')
      } else if (err.response?.status === 403) {
        setError('You do not have permission to leave this group')
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || 'Cannot leave group. You may be the only admin.')
      } else {
        setError(err.message || 'Failed to leave group. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedGroup, fetchGroups])

  return (
    <div className="flex h-screen bg-[rgb(var(--bg-primary))]">
      {/* Sidebar - Groups List */}
      <div className="w-80 glass-effect border-r border-[rgb(var(--border-secondary))] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[rgb(var(--bg-secondary))]/80 border-b border-[rgb(var(--border-secondary))]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-amber-100 glow-green">
                  {currentUserName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-gray-500 font-normal truncate" title={currentUserName}>
                  {currentUserName.length > 20 ? `${currentUserName.substring(0, 20)}...` : currentUserName}
                </h2>
                <p className="text-xs text-green-400 font-medium">Groups</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative border border-b-black border-[rgb(var(--border-secondary))] rounded-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:border-transparent transition-all"
            />
          </div>

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
          { /* Create Group Button */}
                <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full px-4 py-2 bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-lg font-medium text-xs transition-all hover:from-green-500 hover:to-emerald-600 shadow-md glow-green flex items-center justify-center gap-2"
                >
                <Plus className="w-4 h-4" />
                New Group
                </button>
          </div>
      </div>

              {/* Groups List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" />
                Groups ({groups.length})
                </div>

                {loadingGroups ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                </div>
                ) : groups.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-xs">No groups yet</p>
                </div>
                ) : (
                <div className="space-y-2 p-3">
                  {groups
                    .filter((group) => {
                      if (!searchQuery.trim()) return true
                      return group.name.toLowerCase().includes(searchQuery.toLowerCase())
                    })
                    .map((group) => (
                  <div
                    key={group._id}
                    onClick={() => handleSelectGroup(group)}
                    className={`p-2 rounded-xl cursor-pointer transition-all ${
                    selectedGroup?._id === group._id
                      ? "bg-linear-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg glow-green"
                      : "hover:bg-[rgb(var(--bg-hover))]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-linear-to-br  to-green-600 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-black truncate">{group.name}</h3>
                      {/* <p className="text-xs text-gray-500">{group.members?.length || 0} members</p> */}
                    </div>
                    </div>
                  </div>
                  ))}
                </div>
                )}
              </div>
              </div>

             {/* Main Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[rgb(var(--bg-primary))]">
                  {selectedGroup ? (
                    <div className="flex flex-col h-full">
                  {/* Chat Header */}
                  <div className="p-4 glass-effect border-b border-[rgb(var(--border-secondary))] flex items-center justify-between shrink-0">
                  {/* Back Button */}
                            <button
                            onClick={(e) => {
                              e.preventDefault()
                              setSelectedGroup(null)
                              setMessages([])
                              setMembers([])
                              setNewMessage('')
                            }}
                            className="p-2 hover:bg-gray-600/20 rounded-lg transition-all text-gray-400 hover:text-gray-300"
                            title="Go back"
                            >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            </button>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-11 h-11 rounded-full bg-linear-to-br  to-green-600 flex items-center justify-center text-white font-bold shadow-lg shrink-0">
                            {selectedGroup.name.charAt(0).toUpperCase()}
                              </div>
                              
                              <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-black text-lg truncate">{selectedGroup.name}</h3>
                            <p className="text-xs text-gray-400">{members.length} members</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* View Members Button */}
                      <button
                        onClick={() => setShowMembersPreview(!showMembersPreview)}
                        className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 flex items-center gap-2"
                        title="View Members"
                      >
                        <Users className="w-4 h-4" />
                        Members
                      </button>
                      {/* Leave Group Button */}
                      <button
                        onClick={handleLeaveGroup}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Leave this group permanently"
                      >
                        <X className="w-4 h-4" />
                        {loading ? 'Leaving...' : 'Leave'}
                      </button>
                      {selectedGroup.adminId?._id === currentUserId && (
                        <button
                          onClick={() => setShowAddMember(!showAddMember)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all shrink-0 ${
                            showAddMember
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                          } flex items-center gap-2`}
                        >
                          {showAddMember ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {showAddMember ? 'Cancel' : 'Add Member'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Member Form */}
                  {showAddMember && (
                    <div className="p-4 glass-effect border-b border-[rgb(var(--border-secondary))] space-y-3 shrink-0 max-h-64 overflow-y-auto">
                      <h3 className="font-semibold text-black mb-3">Add Members to Group</h3>

                      {/* Search Input */}
                      <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                    />
                      </div>

                      {/* Users List */}
                      <div className="max-h-40 overflow-y-auto custom-scrollbar">
                    {loadingUsers ? (
                      <p className="text-gray-500 text-sm text-center py-4">Loading users...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        {searchQuery ? 'No users found' : 'No available users'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {filteredUsers.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => setSelectedUserId(user._id)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                          selectedUserId === user._id
                        ? "bg-green-600/20 border border-green-500/50"
                        : "hover:bg-[rgb(var(--bg-hover))]/50"
                        }`}
                      >
                        <p className="font-semibold text-sm text-black">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                        ))}
                      </div>
                    )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddMember}
                      disabled={!selectedUserId || loadingAddMember}
                      className="flex-1 px-4 py-2 bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-lg font-medium text-sm transition-all hover:from-green-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAddMember ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={closeAddMemberForm}
                      className="flex-1 px-4 py-2 bg-gray-600/20 text-gray-400 rounded-lg font-medium text-sm transition-all hover:bg-gray-600/30"
                    >
                      Cancel
                    </button>
                      </div>

                      {error && <p className="text-red-400 text-sm">{error}</p>}
                    </div>
                  )}

                  {/* Messages and Members Layout */}
                  <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
                    {/* Messages Section */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-linear-to-b from-[rgb(var(--bg-primary))] to-[rgb(var(--bg-secondary))]">
                    {loadingMessages && messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-24 h-24 rounded-full bg-linear-to-br to-green-500/20 flex items-center justify-center mb-4 shadow-lg">
                      <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/></svg>
                        </div>
                        <p className="text-lg font-semibold text-transparent bg-clip-text \ to-green-400 mb-2">No Messages Yet</p>
                        <p className="text-gray-400 text-center max-w-md">
                      Start the conversation by typing a message below
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const readInfo = getMessageReadInfo(msg._id)
                        const isExpanded = expandedMessageId === msg._id
                        return (
                        <div key={msg._id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br\ to-green-500 flex items-center justify-center text-green text-sm font-bold shadow-lg shrink-0">
                          {msg.sender?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-green-400 font-medium mb-1">{msg.sender?.name || 'Unknown'}</p>
                          <div className="glass-effect text-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-lg backdrop-blur-sm inline-block max-w-[70%] border border-green-500/20">
                        <p className="leading-relaxed">{msg.content}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 ml-2">
                            <p className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {/* Read Receipt Button */}
                            <button
                              onClick={() => {
                                setExpandedMessageId(isExpanded ? null : msg._id)
                                if (!isExpanded) {
                                  markMessageAsRead(msg._id)
                                }
                              }}
                              className="ml-auto p-1 rounded hover:bg-green-500/20 flex items-center gap-1 text-gray-400 hover:text-green-400 transition-all"
                              title="View read receipts"
                            >
                              <CheckCheck className="w-4 h-4" />
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {/* Read Receipt Dropdown */}
                          {isExpanded && (
                            <div className="mt-2 ml-2 p-3 bg-white-800/50 rounded-lg border border-green-500/20 animate-in fade-in">
                              <p className="text-xs font-semibold text-green-400 mb-2">
                                Read by {readInfo.readers.length}/{readInfo.totalRecipients + 1} members
                              </p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {/* Current user as sender */}
                                {msg.sender?._id === currentUserId && (
                                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-green-500/10">
                                    <div className="w-6 h-6 rounded-full bg-linear-to-br  to-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                      {msg.sender?.name?.charAt(0).toUpperCase() || 'Y'}
                                    </div>
                                    <span className="text-xs text-white-300 flex-1">{msg.sender?.name || 'You'} (Sender)</span>
                                    <CheckCheck className="w-3 h-3 text-green-400" />
                                  </div>
                                )}
                                
                                {/* Other members */}
                                {readInfo.readers.map((reader) => (
                                  <div key={reader._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700/50">
                                    <div className="w-6 h-6 rounded-full bg-linear-to-br  to-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                      {reader.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">{reader.name || 'Unknown'}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-400">Unread</span>
                                      <Check className="w-3 h-3 text-gray-500" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                        </div>
                        )
                      })
                    )}
                      </div>

                      {/* Message Input */}
                      <div className="border-t border-[rgb(var(--border-secondary))] p-4 bg-[rgb(var(--bg-secondary))]/50 glass-effect shrink-0">
                    {error && (
                      <div className="mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2 animate-in fade-in">
                        <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-red-400 text-sm font-medium">Error</p>
                          <p className="text-red-300 text-xs mt-1">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="text-red-400 hover:text-red-300 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-3">
                      <div className="flex-1 glass-effect rounded-2xl border border-[rgb(var(--border-secondary))] focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/30 transition-all">
                        <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder="Type a message..."
                      rows="1"
                      className="w-full px-4 py-3 bg-transparent text-black placeholder-gray-500 resize-none focus:outline-none max-h-32 custom-scrollbar"
                      style={{ minHeight: "48px" }}
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={loading || !newMessage.trim()}
                        className={`p-3 rounded-xl transition-all shadow-lg shrink-0 ${
                      newMessage.trim()
                        ? "bg-linear-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white glow-green"
                        : "bg-gray-600/20 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.488 5.951 1.488a1 1 0 001.169-1.409l-7-14z"/></svg>
                      </button>
                    </div>
                      </div>
                    </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="w-32 h-32 rounded-full bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-2xl">
              <Users className="w-16 h-16 text-green-500/50" />
            </div>
            <h3 className="text-3xl font-bold mb-3 gradient-text">Select a Group</h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Choose a group from the sidebar to start chatting
            </p>
          </div>
        )}
      </div>

      {/* Members Preview Modal */}
      {showMembersPreview && selectedGroup && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass-effect rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden border border-[rgb(var(--border-secondary))] shadow-2xl animate-slideUp flex flex-col">
            {/* Header */}
            <div className="sticky top-0 p-6 bg-[rgb(var(--bg-secondary))]/80 backdrop-blur-md border-b border-[rgb(var(--border-secondary))] z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-black">Group Members</h2>
                  <p className="text-xs text-gray-500">{selectedGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMembersPreview(false)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mb-3 opacity-50" />
                  <p className="text-gray-500 text-center">No members in this group</p>
                </div>
              ) : (
                members.map((member, idx) => (
                  <div
                    key={member._id}
                    className="p-4 bg-linear-to-r from-green-500/10 to-emerald-500/10 border border-[rgb(var(--border-secondary))] hover:border-green-500/40 rounded-xl transition-all duration-300 hover:shadow-lg animate-slideInRight"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br  to-green-600 flex items-center justify-center text-white font-bold shadow-lg shrink-0 text-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-black truncate">{member.name}</p>
                          <p className="text-xs text-gray-500 truncate">{member.email}</p>
                          {member.isOnline && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                              <p className="text-xs text-green-400 font-semibold">Online</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedGroup.adminId?._id === member._id && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold shrink-0">
                          Admin
                        </span>
                      )}
                      {selectedGroup.adminId?._id === currentUserId && members.length > 2 && currentUserId !== member._id && (
                        <button
                          onClick={() => handleRemoveMember(member._id)}
                          disabled={loadingRemoveMember === member._id}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300 disabled:opacity-50 shrink-0"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Info */}
            <div className="border-t border-[rgb(var(--border-secondary))] p-4 bg-[rgb(var(--bg-secondary))]/50">
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Total Members</p>
                  <p className="text-xl font-bold text-black">{members.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Online</p>
                  <p className="text-xl font-bold text-green-400">{members.filter(m => m.isOnline).length}</p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="p-4 border-t border-[rgb(var(--border-secondary))]">
              <button
                onClick={() => setShowMembersPreview(false)}
                className="w-full px-4 py-2.5 bg-gray-600/20 text-gray-400 rounded-lg font-medium text-sm transition-all hover:bg-gray-600/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-effect rounded-2xl w-96 max-h-[90vh] overflow-y-auto p-6 border border-[rgb(var(--border-secondary))] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-black">Create New Group</h2>
              <button
                onClick={closeCreateGroupForm}
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-gray-400 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-black mb-2">Group Name</label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>

            {/* Members Search */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-black mb-2">
                Select Members ({selectedMemberIds.length})
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={createGroupSearch}
                  onChange={(e) => setCreateGroupSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[rgb(var(--bg-tertiary))]/50 border border-[rgb(var(--border-secondary))] rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="mb-4 max-h-48 overflow-y-auto custom-scrollbar">
              {loadingUsers ? (
                <p className="text-gray-500 text-sm text-center py-4">Loading users...</p>
              ) : filteredCreateUsers.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  {createGroupSearch ? 'No users found' : 'No users available'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredCreateUsers.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => toggleMemberSelection(user._id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedMemberIds.includes(user._id)
                          ? "bg-green-600/20 border border-green-500/50"
                          : "hover:bg-[rgb(var(--bg-hover))]/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 ${
                          selectedMemberIds.includes(user._id)
                            ? "border-green-500 bg-green-500"
                            : "border-gray-400"
                        }`} />
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-black">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Members Summary */}
            {selectedMemberIds.length > 0 && (
              <div className="mb-4 p-3 bg-green-600/10 rounded-lg border border-green-500/30">
                <p className="text-sm font-semibold text-black mb-2">
                  Selected: {selectedMemberIds.length}
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {filteredCreateUsers
                    .filter((u) => selectedMemberIds.includes(u._id))
                    .map((user) => (
                      <p key={user._id} className="text-xs text-gray-600">
                        • {user.name}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMemberIds.length === 0 || loadingCreateGroup}
                className="flex-1 px-4 py-2.5 bg-linear-to-br from-green-600 to-emerald-700 text-white rounded-lg font-medium text-sm transition-all hover:from-green-500 hover:to-emerald-600 shadow-md glow-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCreateGroup ? 'Creating...' : 'Create Group'}
              </button>
              <button
                onClick={closeCreateGroupForm}
                className="flex-1 px-4 py-2.5 bg-gray-600/20 text-gray-400 rounded-lg font-medium text-sm transition-all hover:bg-gray-600/30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupChat
