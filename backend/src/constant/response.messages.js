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
  ERROR_MESSAGE: 'error_message',
  GROUP_MESSAGE: 'group_message',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_SENT: 'message_sent',
  ONLINE_USERS: 'online_users',
  PRIVATE_MESSAGE: 'private_message',
  USER_JOINED_GROUP: 'user_joined_group',
  USER_LEFT_GROUP: 'user_left_group'
};