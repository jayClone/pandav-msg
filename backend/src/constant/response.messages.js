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

    FRIEND: {
    REQUEST_SENT: "Friend request sent successfully",
    REQUEST_ACCEPTED: "Friend request accepted",
    REQUEST_REJECTED: "Friend request rejected",
    ALREADY_FRIENDS: "Already friends",
    REQUEST_PENDING: "Friend request already pending",
    NOT_FRIENDS: "You are not friends",
    FRIEND_REMOVED: "Friend removed successfully",
    CANNOT_MESSAGE: "You can only message friends",
    CANNOT_CALL: "You can only call friends",
  },
};

// UPDATE SOCKET_EVENTS
export const SOCKET_EVENTS = {
  ONLINE_USERS: "online_users",
  PRIVATE_MESSAGE: "private_message",
  MESSAGE_SENT: "message_sent",
  USER_OFFLINE: "user_offline",
  ERROR_MESSAGE: "error_message",
  MESSAGE_DELETED: "message_deleted",
  MESSAGE_REACTION: "message_reaction",
  TYPING: "typing",
  MESSAGE_READ: "message_read",
  GROUP_MESSAGE: "group_message",
  JOIN_GROUP: "join_group",
  LEAVE_GROUP: "leave_group",
  READ_RECEIPT: "read_receipt",
  USER_CAME_ONLINE: "user_came_online",
  USER_WENT_OFFLINE: "user_went_offline",

  // Friend-graph and group-membership changes were REST-only — no live
  // notification to the other party. These close that gap.
  FRIEND_REQUEST_RECEIVED: "friend_request_received",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",
  FRIEND_REQUEST_REJECTED: "friend_request_rejected",
  FRIEND_REMOVED: "friend_removed",

  GROUP_CREATED: "group_created",
  GROUP_MEMBER_ADDED: "group_member_added",
  GROUP_MEMBER_REMOVED: "group_member_removed",
  GROUP_MEMBER_LEFT: "group_member_left",
  GROUP_DELETED: "group_deleted",
  GROUP_AVATAR_UPDATED: "group_avatar_updated",

  // 1:1 voice/video calling — WebRTC signaling relay only, no media
  // touches the server.
  CALL_OFFER: "call_offer",
  CALL_ANSWER: "call_answer",
  CALL_ICE_CANDIDATE: "call_ice_candidate",
  CALL_REJECT: "call_reject",
  CALL_END: "call_end",
  CALL_UNAVAILABLE: "call_unavailable",
};