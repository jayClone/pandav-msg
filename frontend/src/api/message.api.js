import API from "@api/axios.js"

const messageApi = {
  // Get all messages with a user
  getChatHistory: (userId) => {
    if (!userId) throw new Error("userId is required")
    return API.get(`/messages/${userId}`)
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

  // Delete a message
  deleteMessage: (messageId) => {
    if (!messageId) throw new Error("messageId is required")
    return API.delete(`/messages/${messageId}`)
  },
}

export default messageApi