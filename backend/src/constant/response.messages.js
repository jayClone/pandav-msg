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
};

export const SOCKET_EVENTS = {
  ONLINE_USERS: "online_users",
  PRIVATE_MESSAGE: "private_message",
  MESSAGE_SENT: "message_sent",
  USER_OFFLINE: "user_offline",
  ERROR_MESSAGE: "error_message",
  MESSAGE_DELETED: "message_deleted"
};