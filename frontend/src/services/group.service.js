import groupApi from '@api/group.api.js'

class GroupService {
  async createGroup(groupName, memberIds) {
    try {
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
    } catch (error) {
      console.error('createGroup error:', error)
      throw error
    }
  }

  async getMyGroups() {
    try {
      const response = await groupApi.getMyGroups()
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch groups')
      }

      return data.data || []
    } catch (error) {
      console.error('getMyGroups error:', error)
      throw error
    }
  }

  async getGroup(groupId) {
    try {
      const response = await groupApi.getGroup(groupId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch group')
      }

      return data.data
    } catch (error) {
      console.error('getGroup error:', error)
      throw error
    }
  }

  async getGroupMessages(groupId) {
    try {
      const response = await groupApi.getGroupMessages(groupId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch group messages')
      }

      return {
        messages: data.data || [],
        count: data.count,
      }
    } catch (error) {
      console.error('getGroupMessages error:', error)
      throw error
    }
  }

  async addMember(groupId, memberId) {
    try {
      const response = await groupApi.addMember(groupId, memberId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || 'Failed to add member')
      }

      return data.data
    } catch (error) {
      console.error('addMember error:', error)
      throw error
    }
  }

  async removeMember(groupId, memberId) {
    try {
      const response = await groupApi.removeMember(groupId, memberId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || 'Failed to remove member')
      }

      return true
    } catch (error) {
      console.error('removeMember error:', error)
      throw error
    }
  }
}

export default new GroupService()