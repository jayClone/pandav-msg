import messageApi from "@api/message.api.js"

class MessageService {
  constructor() {
    // Simple in-memory cache for chat histories
    this.chatCache = new Map()
    this.conversationsCache = null
    this.conversationsCacheTime = 0
  }

  // Clear cache for a specific user
  invalidateUserCache(userId) {
    this.chatCache.delete(userId)
  }

  // Clear all cache
  invalidateAllCache() {
    this.chatCache.clear()
    this.conversationsCache = null
  }

  // Fetch chat history with caching
  async fetchChatHistory(userId) {
    try {
      // Check cache (10 second TTL)
      if (this.chatCache.has(userId)) {
        const cached = this.chatCache.get(userId)
        if (Date.now() - cached.time < 1000) {
          console.log("✅ Using cached chat history for", userId)
          return cached.data
        }
      }

      const response = await messageApi.getChatHistory(userId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch chat")
      }

      const result = {
        messages: data.data || [],
        otherUser: data.otherUser,
        count: data.count,
      }

      // Cache the result
      this.chatCache.set(userId, { data: result, time: Date.now() })

      return result
    } catch (error) {
      console.error("fetchChatHistory error:", error)
      throw error
    }
  }

  // Fetch all conversations with caching
  async fetchConversations() {
    try {
      // Check cache (15 second TTL)
      if (this.conversationsCache && Date.now() - this.conversationsCacheTime < 15000) {
        console.log("✅ Using cached conversations")
        return this.conversationsCache
      }

      const response = await messageApi.getConversations()
      const { data } = response

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

      const sorted = conversations.sort(
        (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      )

      // Cache the result
      this.conversationsCache = sorted
      this.conversationsCacheTime = Date.now()

      return sorted
    } catch (error) {
      console.error("fetchConversations error:", error)
      throw error
    }
  }

  // Mark messages as read
  async markMessagesAsRead(userId) {
    try {
      const response = await messageApi.markAsRead(userId)
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || "Failed to mark as read")
      }

      // Invalidate cache since messages changed
      this.invalidateUserCache(userId)

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
      const { data } = response

      if (!data.success) {
        throw new Error(data.message || "Failed to delete message")
      }

      // Invalidate all caches since message was deleted
      this.invalidateAllCache()

      return true
    } catch (error) {
      console.error("deleteMessage error:", error)
      throw error
    }
  }
}

export default new MessageService()