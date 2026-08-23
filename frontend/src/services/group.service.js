import groupApi from '@api/group.api.js'

class GroupService {
  async createGroup(groupName, memberIds) {
    // Validate inputs
    if (!groupName || !groupName.trim()) {
      throw new Error('Group name is required')
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      throw new Error('At least one member is required')
    }

    const response = await groupApi.createGroup({
      name: groupName.trim(),
      memberIds
    })
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to create group')
    }

    return data.data
  }

  async getMyGroups() {
    const response = await groupApi.getMyGroups()
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch groups')
    }

    return data.data || []
  }

  async getGroup(groupId) {
    const response = await groupApi.getGroup(groupId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch group')
    }

    // Transform backend format to frontend format
    const group = {
      ...data.data,
      members: data.data.participants || [] // Backend uses 'participants', frontend uses 'members'
    }

    return group
  }

  async getGroupMessages(groupId) {
    const response = await groupApi.getGroupMessages(groupId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch group messages')
    }

    // Transform backend message format to frontend format
    const messages = (data.data || []).map(msg => ({
      _id: msg._id,
      content: msg.message, // Backend uses 'message', frontend uses 'content'
      sender: msg.senderId, // Backend uses 'senderId', frontend uses 'sender'
      createdAt: msg.createdAt,
      read: msg.read
    }))

    return {
      messages: messages,
      count: data.count,
      totalCount: data.totalCount,
      page: data.page,
      totalPages: data.totalPages
    }
  }

  async addMember(groupId, memberId) {
    if (!groupId || !memberId) {
      throw new Error('Group ID and Member ID are required')
    }

    const response = await groupApi.addMember(groupId, memberId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to add member')
    }

    // Return transformed group with members array
    return {
      ...data.data,
      members: data.data.participants || [] // Backend uses 'participants', frontend uses 'members'
    }
  }

  async removeMember(groupId, memberId) {
    if (!groupId || !memberId) {
      throw new Error('Group ID and Member ID are required')
    }

    const response = await groupApi.removeMember(groupId, memberId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to remove member')
    }

    // Return transformed group with members array
    return {
      ...data.data,
      members: data.data.participants || []
    }
  }

  async leaveGroup(groupId) {
    if (!groupId) {
      throw new Error('Group ID is required')
    }

    const response = await groupApi.leaveGroup(groupId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to leave group')
    }

    return data.data
  }
  async deleteGroup(groupId) {
    if (!groupId) {
      throw new Error('Group ID is required')
    }

    const response = await groupApi.deleteGroup(groupId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to delete group')
    }

    return data.data
  }

  async updateAvatar(groupId, avatarData) {
    const response = await groupApi.updateAvatar(groupId, avatarData)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to update group picture')
    }

    return data.data
  }

  async removeAvatar(groupId) {
    const response = await groupApi.removeAvatar(groupId)
    const { data } = response

    if (!data.success) {
      throw new Error(data.message || 'Failed to remove group picture')
    }

    return data.data
  }
}

export default new GroupService()
