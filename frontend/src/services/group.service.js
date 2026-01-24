import API from '@api/axios.js';

const groupService = {
  /**
   * Create a new group
   * @param {string} name - Group name
   * @param {array} participantIds - Array of user IDs to add to the group
   * @returns {Promise<object>} Created group data
   */
  createGroup: async (name, participantIds) => {
    try {
      // Validate inputs
      if (!name || name.trim() === '') {
        throw new Error('Group name is required');
      }
      
      console.log("🔍 Initial participantIds check:", {
        type: typeof participantIds,
        isArray: Array.isArray(participantIds),
        value: participantIds,
        length: participantIds?.length
      });
      
      // Filter out any null/undefined/empty values
      const validIds = participantIds?.filter(id => id && id.toString().trim() !== '') || [];
      
      console.log("🔍 After filtering:", {
        originalLength: participantIds?.length,
        validLength: validIds.length,
        validIds: validIds
      });
      
      if (!validIds || validIds.length === 0) {
        console.error('❌ Invalid participantIds after filtering:', { 
          original: participantIds,
          filtered: validIds 
        });
        throw new Error('At least one member is required');
      }

      console.log("📤 Creating group with:", { 
        name, 
        participantIds: validIds,
        participantCount: validIds.length 
      });

      const payload = {
        name: name.trim(),
        memberIds: validIds  // Backend expects 'memberIds' field with valid IDs
      };

      console.log("📦 Final payload to send:", JSON.stringify(payload, null, 2));
      console.log("📦 Payload memberIds type:", payload.memberIds.map((id, idx) => `[${idx}]: ${typeof id} = ${id}`));

      const response = await API.post('/groups', payload);
      console.log("✅ Group creation response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Group creation error:", error);
      console.error("Error response:", error.response);
      console.error("Error data:", error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to create group';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get all groups for the logged-in user with populated members/participants
   * @returns {Promise<array>} Array of groups
   */
  getMyGroups: async () => {
    try {
      console.log("📤 Fetching user groups...");
      const response = await API.get('/groups');
      console.log("✅ Groups fetched:", response.data);
      
      // Normalize groups data - handle both members and participants fields
      const normalizedGroups = Array.isArray(response.data) ? response.data : (response.data.groups || response.data.data || []);
      
      const processedGroups = normalizedGroups.map(group => ({
        ...group,
        // Ensure members field exists with user data
        members: normalizeMembers(group.members || group.participants || [])
      }));
      
      console.log("✅ Normalized groups:", processedGroups);
      return processedGroups;
    } catch (error) {
      console.error("❌ Failed to fetch groups:", error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch groups';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get a single group by ID with populated members/participants
   * @param {string} groupId - Group ID
   * @returns {Promise<object>} Group data
   */
  getGroup: async (groupId) => {
    try {
      console.log("📤 Fetching group:", groupId);
      const response = await API.get(`/groups/${groupId}`);
      
      // Normalize group data
      const group = response.data.group || response.data.data || response.data;
      
      console.log("📥 Raw group data:", group);
      
      const normalizedGroup = {
        ...group,
        // Ensure members field exists with user data - handle both members and participants
        members: normalizeMembers(group.members || group.participants || [])
      };
      
      console.log("✅ Normalized group:", normalizedGroup);
      return normalizedGroup;
    } catch (error) {
      console.error("❌ Failed to fetch group:", error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch group';
      throw new Error(errorMessage);
    }
  },

  /**
   * Add a member to a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to add
   * @returns {Promise<object>} Updated group data
   */
  addMember: async (groupId, userId) => {
    try {
      const response = await API.post(`/groups/${groupId}/members`, {
        userId
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add member';
      throw new Error(errorMessage);
    }
  },

  /**
   * Remove a member from a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<object>} Updated group data
   */
  removeMember: async (groupId, userId) => {
    try {
      const response = await API.delete(`/groups/${groupId}/members`, {
        data: { userId }
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove member';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get group chat history/messages
   * @param {string} groupId - Group ID
   * @returns {Promise<object>} Messages data
   */
  getGroupMessages: async (groupId) => {
    try {
      console.log("📤 Fetching messages for group:", groupId);
      const response = await API.get(`/groups/${groupId}/messages`);
      console.log("✅ Messages fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to fetch group messages:", error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch group messages';
      throw new Error(errorMessage);
    }
  }
};

/**
 * Helper function to normalize members/participants data
 * Handles both direct user objects and populated user references
 * @param {array} members - Array of members or participant IDs
 * @returns {array} Normalized members array with user data
 */
const normalizeMembers = (members) => {
  if (!Array.isArray(members)) return [];
  
  return members.map(member => {
    // If member is just an ID string, return as-is (will be populated by backend)
    if (typeof member === 'string') {
      console.log("🔍 Member is string ID:", member);
      return {
        _id: member,
        userId: member,
        name: "Unknown",
        userName: "Unknown"
      };
    }
    
    // If member is an object, normalize user data fields
    if (typeof member === 'object' && member !== null) {
      console.log("🔍 Normalizing member object:", member);
      
      // Extract user data - handle different field names
      const userData = member.userId || member.user || {};
      const userId = member.userId?._id || member.userId || member._id;
      const userName = member.name || member.userName || userData.name || userData.userName || "Unknown";
      
      return {
        _id: member._id || userId,
        userId: userId,
        name: userName,
        userName: userName,
        email: member.email || userData.email,
        isAdmin: member.isAdmin || member.role === "admin",
        role: member.role,
        createdBy: member.createdBy,
        // Include full user object if available
        user: userData
      };
    }
    
    // Fallback for unknown format
    return {
      _id: member,
      userId: member,
      name: "Unknown",
      userName: "Unknown"
    };
  });
};

export default groupService;
