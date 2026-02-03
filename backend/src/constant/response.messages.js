export const MESSAGES = {
  AUTH: {
    TOKEN_MISSING: "Invalid or expired token",
    TOKEN_INVALID: "Invalid token",
  },

  SOCKET: {
    TO_USER_REQUIRED: "toUserId is required",
    MESSAGE_EMPTY: "message cannot be empty",
    SOMETHING_WENT_WRONG: "Something went wrong",
  },

  GROUP: {
    GROUP_ID_REQUIRED: "Group ID is required",
    GROUP_NOT_FOUND: "Group not found",
    USER_NOT_MEMBER: "You are not a member of this group",
    GROUP_CREATED: "Group created successfully",
    GROUP_DELETED: "Group deleted successfully",
    GROUP_UPDATED: "Group updated successfully",
    MEMBER_ADDED: "Member added successfully",
    MEMBER_REMOVED: "Member removed successfully",
    MESSAGE_SENT: "Message sent successfully",
    MESSAGE_EMPTY: "Message cannot be empty",
    INVALID_MEMBER: "Invalid member ID",
    ALREADY_MEMBER: "User is already a member",
    CANNOT_REMOVE_CREATOR: "Cannot remove group creator",
  },
};

export const SOCKET_EVENTS = {
  ONLINE_USERS: "online_users",
  PRIVATE_MESSAGE: "private_message",
  MESSAGE_SENT: "message_sent",
  USER_OFFLINE: "user_offline",
  ERROR_MESSAGE: "error_message",
  MESSAGE_DELETED: "message_deleted",
  TYPING: "typing",
  MESSAGE_READ: "message_read",
  GROUP_MESSAGE: "group_message",
  JOIN_GROUP: "join_group",
  LEAVE_GROUP: "leave_group",
  READ_RECEIPT: "read_receipt",
};