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
  addMember: (groupId, memberId) =>
    API.post(`/groups/${groupId}/members`, { memberId }),

  /**
   * Remove member from group
   */
  removeMember: (groupId, memberId) =>
    API.delete(`/groups/${groupId}/members`, {
      data: { memberId }
    }),
}

export default groupApi