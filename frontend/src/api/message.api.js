import API from "@api/axios.js"

const messageApi = {
  // Get all messages with a user (paginated)
  getChatHistory: (userId, before = null, limit = 50) => {
    if (!userId) throw new Error("userId is required")
    const params = { limit };
    if (before) params.before = before;
    return API.get(`/messages/${userId}`, { params })
  },

  // Get group messages (paginated)
  getGroupMessages: (groupId, before = null, limit = 50) => {
    if (!groupId) throw new Error("groupId is required")
    const params = { limit };
    if (before) params.before = before;
    return API.get(`/groups/${groupId}/messages`, { params })
  },

  // Get all conversations
  getConversations: () => {
    return API.get("/messages/conversations/all")
  },

  // Mark messages as read
  markAsRead: (userId) => {
    if (!userId) throw new Error("userId is required")
    return API.put(`/messages/read/${userId}`)
  },

  // Send private message
  sendPrivateMessage: (receiverId, message) => {
    if (!receiverId || !message) throw new Error("receiverId and message are required")
    return API.post("/messages/private", { receiverId, message })
  },

  // Send group message
  sendGroupMessage: (groupId, message) => {
    if (!groupId || !message) throw new Error("groupId and message are required")
    return API.post("/messages/group", { groupId, message })
  },

  // Mark group messages as read
  markGroupMessagesAsRead: (groupId) => {
    if (!groupId) throw new Error("groupId is required")
    return API.put(`/messages/group/${groupId}/read`)
  },

  // Delete a message
  deleteMessage: (messageId) => {
    if (!messageId) throw new Error("messageId is required")
    return API.delete(`/messages/${messageId}`)
  },
}

export default messageApi