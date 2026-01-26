import { useState, useEffect, useCallback } from 'react'
import groupService from '@services/group.service'
import messageService from '@services/message.service'
import API from '@api/axios.js'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'
import { Input } from '@components/ui/input'

const GroupChat = () => {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
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

  // Fetch all groups on component mount
  useEffect(() => {
    fetchGroups()
  }, [])

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

  const fetchAvailableUsers = useCallback(async () => {
    try {
      setLoadingUsers(true)
      setError(null)
      const response = await API.get('/users')
      const allUsers = response.data.data || []

      // Filter out already added members
      const memberIds = new Set(members.map((m) => m._id))
      const currentUserId = localStorage.getItem('userId')

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
  }, [members])

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
      const currentUserId = localStorage.getItem('userId')

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
    if (!selectedGroup || !selectedUserId) {
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
      await groupService.addMember(selectedGroup._id, selectedUserId)
      setSearchQuery('')
      setSelectedUserId(null)
      setShowAddMember(false)
      const updatedGroup = await groupService.getGroup(selectedGroup._id)
      setSelectedGroup(updatedGroup)
      setMembers(updatedGroup.members || [])
      await fetchAvailableUsers()
    } catch (err) {
      setError(err.message || 'Failed to add member')
      console.error('Error adding member:', err)
    } finally {
      setLoadingAddMember(false)
    }
  }, [selectedGroup, selectedUserId, availableUsers, fetchAvailableUsers])

  const handleRemoveMember = useCallback(async (memberId) => {
    if (!selectedGroup) return

    try {
      setLoadingRemoveMember(memberId)
      setError(null)
      await groupService.removeMember(selectedGroup._id, memberId)
      const updatedGroup = await groupService.getGroup(selectedGroup._id)
      setSelectedGroup(updatedGroup)
      setMembers(updatedGroup.members || [])
      await fetchAvailableUsers()
    } catch (err) {
      setError(err.message || 'Failed to remove member')
      console.error('Error removing member:', err)
    } finally {
      setLoadingRemoveMember(null)
    }
  }, [selectedGroup, fetchAvailableUsers])

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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Groups Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-300 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Groups</h2>
          <Button
            onClick={() => setShowCreateGroup(true)}
            className="bg-green-500 hover:bg-green-600 text-white text-sm"
            disabled={loadingCreateGroup}
          >
            + New
          </Button>
        </div>

        {loadingGroups && <p className="text-gray-500">Loading groups...</p>}
        {error && !selectedGroup && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-gray-500 text-sm">No groups found</p>
          ) : (
            groups.map((group) => (
              <Card
                key={group._id}
                className={`p-3 cursor-pointer transition ${
                  selectedGroup?._id === group._id
                    ? 'bg-blue-100 border-blue-300'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectGroup(group)}
              >
                <h3 className="font-semibold text-sm">{group.name}</h3>
                <p className="text-xs text-gray-500">{group.members?.length || 0} members</p>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedGroup ? (
          <>
            {/* Group Header */}
            <div className="bg-white border-b border-gray-300 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">{selectedGroup.name}</h1>
                  <p className="text-gray-500 text-sm">{members.length} members</p>
                </div>
                <Button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className={`${
                    showAddMember ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                  disabled={loadingAddMember}
                >
                  {showAddMember ? 'Cancel' : '+ Add Member'}
                </Button>
              </div>

              {/* Add Member Form */}
              {showAddMember && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold mb-3">Add Members to Group</h3>

                  {/* Search Input */}
                  <div className="mb-3">
                    <Input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                  </div>

                  {/* Users List */}
                  {loadingUsers ? (
                    <p className="text-gray-500 text-sm text-center py-4">Loading users...</p>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      {searchQuery ? 'No users found matching your search' : 'No available users to add'}
                    </p>
                  ) : (
                    <div className="border border-gray-300 rounded max-h-64 overflow-y-auto mb-3">
                      {filteredUsers.map((user) => (
                        <div
                          key={user._id}
                          className={`p-3 cursor-pointer transition border-b last:border-b-0 ${
                            selectedUserId === user._id
                              ? 'bg-blue-100'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => setSelectedUserId(user._id)}
                        >
                          <div className="flex items-center">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{user.name}</p>
                              <p className="text-xs text-gray-600">{user.email}</p>
                            </div>
                            {selectedUserId === user._id && (
                              <div className="text-blue-600 text-lg">✓</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddMember}
                      disabled={!selectedUserId || loadingAddMember}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    >
                      {loadingAddMember ? 'Adding...' : 'Add Selected Member'}
                    </Button>
                    <Button
                      onClick={closeAddMemberForm}
                      className="flex-1 bg-gray-400 hover:bg-gray-500 text-white"
                    >
                      Cancel
                    </Button>
                  </div>

                  {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
                </div>
              )}

              {error && !showAddMember && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            {/* Messages and Members Layout */}
            <div className="flex-1 flex gap-4 p-4 overflow-hidden">
              {/* Messages Section */}
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-300">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages && messages.length === 0 ? (
                    <p className="text-gray-500 text-center">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-gray-500 text-center">No messages yet</p>
                  ) : (
                    messages.map((msg) => (
                      <Card key={msg._id} className="p-3 bg-gray-50">
                        <p className="font-semibold text-sm">{msg.sender?.name || 'Unknown'}</p>
                        <p className="text-gray-700">{msg.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </Card>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="border-t border-gray-300 p-4 flex gap-2">
                  <Input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={loading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={loading || !newMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {loading ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>

              {/* Members Section */}
              <div className="w-48 bg-white rounded-lg border border-gray-300 p-4 overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">Members ({members.length})</h3>
                <div className="space-y-2">
                  {members.length === 0 ? (
                    <p className="text-gray-500 text-sm">No members</p>
                  ) : (
                    members.map((member) => (
                      <Card key={member._id} className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{member.name}</p>
                            <p className="text-xs text-gray-500 truncate">{member.email}</p>
                            {member.isOnline && (
                              <p className="text-xs text-green-600 font-semibold">● Online</p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleRemoveMember(member._id)}
                            size="sm"
                            className="bg-red-500 hover:bg-red-600 text-white whitespace-nowrap"
                            disabled={loadingRemoveMember === member._id}
                          >
                            {loadingRemoveMember === member._id ? 'Removing...' : 'Remove'}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-2">Select a group to start chatting</p>
              {groups.length === 0 && (
                <p className="text-gray-400 text-sm">No groups available. Create one to get started!</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 p-6 max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Group</h2>

            {/* Group Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Group Name</label>
              <Input
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Members Search */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Select Members ({selectedMemberIds.length})
              </label>
              <Input
                type="text"
                placeholder="Search users by name or email..."
                value={createGroupSearch}
                onChange={(e) => setCreateGroupSearch(e.target.value)}
                className="w-full mb-2"
              />
            </div>

            {/* Users List */}
            {loadingUsers ? (
              <p className="text-gray-500 text-sm text-center py-4">Loading users...</p>
            ) : filteredCreateUsers.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                {createGroupSearch ? 'No users found' : 'No users available'}
              </p>
            ) : (
              <div className="border border-gray-300 rounded max-h-48 overflow-y-auto mb-4">
                {filteredCreateUsers.map((user) => (
                  <div
                    key={user._id}
                    className={`p-3 cursor-pointer transition border-b last:border-b-0 ${
                      selectedMemberIds.includes(user._id)
                        ? 'bg-blue-100'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleMemberSelection(user._id)}
                  >
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded mr-3 flex items-center justify-center">
                        {selectedMemberIds.includes(user._id) && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-xs text-gray-600">{user.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Members Summary */}
            {selectedMemberIds.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm font-semibold mb-2">
                  Selected Members: {selectedMemberIds.length}
                </p>
                <div className="space-y-1">
                  {filteredCreateUsers
                    .filter((u) => selectedMemberIds.includes(u._id))
                    .map((user) => (
                      <p key={user._id} className="text-xs text-gray-700">
                        • {user.name}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMemberIds.length === 0 || loadingCreateGroup}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                {loadingCreateGroup ? 'Creating...' : 'Create Group'}
              </Button>
              <Button
                onClick={closeCreateGroupForm}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default GroupChat
