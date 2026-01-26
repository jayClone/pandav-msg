import API from './axios.js'

const groupApi = {
  /**
   * Create a new group
   * @param {Object} groupData - {name, memberIds}
   */
  createGroup: (groupData) =>
    API.post('/groups', groupData),

  /**
   * Get all groups for current user
   */
  getMyGroups: () =>
    API.get('/groups'),

  /**
   * Get single group details
   */
  getGroup: (groupId) =>
    API.get(`/groups/${groupId}`),

  /**
   * Get group chat history
   */
  getGroupMessages: (groupId) =>
    API.get(`/groups/${groupId}/messages`),

  /**
   * Add member to group
   */
  addMember: (groupId, memberId) => {
    if (!groupId || !memberId) {
      throw new Error('Group ID and Member ID are required')
    }
    return API.post(`/groups/${String(groupId)}/members`, { 
      userId: String(memberId)
    })
  },

  /**
   * Remove member from group
   */
  removeMember: (groupId, memberId) => {
    if (!groupId || !memberId) {
      throw new Error('Group ID and Member ID are required')
    }
    return API.delete(`/groups/${String(groupId)}/members`, {
      data: { userId: String(memberId) }
    })
  },

  /**
   * Leave a group
   */
  leaveGroup: (groupId) => {
    if (!groupId) {
      throw new Error('Group ID is required')
    }
    return API.post(`/groups/${String(groupId)}/leave`)
  },
}

export default groupApi
