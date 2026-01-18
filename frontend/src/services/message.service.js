import messageApi from "../api/message.api.js"

class MessageService {
  // Fetch chat history with error handling
  async fetchChatHistory(userId) {
    try {
      const response = await messageApi.getChatHistory(userId)
      
      // ✅ LOG THE ACTUAL RESPONSE
      const {data} = response

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch chat")
      }

      return {
        messages: data.data || [],
        otherUser: data.otherUser,
        count: data.count,
      }
    } catch (error) {
      console.error("fetchChatHistory error:", error)
      throw error
    }
  }

  // Fetch all conversations
  async fetchConversations() {
    try {
      const response = await messageApi.getConversations()
      
      // ✅ LOG THE ACTUAL RESPONSE
      const {data} = response

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch conversations")
      }

      const conversations = (data.data || []).map(conv => ({
        userId: conv._id,
        name: conv.user?.name || "Unknown",
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount || 0,
      }))

      return conversations.sort(
        (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      )
    } catch (error) {
      console.error("fetchConversations error:", error)
      throw error
    }
  }

  // Mark messages as read
  async markMessagesAsRead(userId) {
    try {
      const response = await messageApi.markAsRead(userId)
      
      // ✅ LOG THE ACTUAL RESPONSE
      const {data} = response

      if (!data.success) {
        throw new Error(data.message || "Failed to mark as read")
      }

      return true
    } catch (error) {
      console.error("markMessagesAsRead error:", error)
      throw error
    }
  }

  // Delete a message
  async deleteMessage(messageId) {
    try {
      const response = await messageApi.deleteMessage(messageId)
      
      // ✅ LOG THE ACTUAL RESPONSE
      const {data} = response

      if (!data.success) {
        throw new Error(data.message || "Failed to delete message")
      }

      return true
    } catch (error) {
      console.error("deleteMessage error:", error)
      throw error
    }
  }
}

export default new MessageService()