import axios from './axios.js';

const friendAPI = {
  // Send friend request
  sendFriendRequest: (receiverId) =>
    axios.post('/friends', { receiverId }),

  // Get pending friend requests
  getPendingRequests: () =>
    axios.get('/friends/pending'),

  // ✅ GET SENT REQUESTS (sent by user) - ADD THIS
  getSentRequests: () =>
    axios.get('/friends/sent'),

  // Accept friend request
  acceptFriendRequest: (requestId) =>
    axios.patch(`/friends/${requestId}/accept`),

  // Reject friend request
  rejectFriendRequest: (requestId) =>
    axios.delete(`/friends/${requestId}`),

  // Get friends list
  getFriends: () =>
    axios.get('/friends'),

  // Check friend status
  checkFriendStatus: (userId) =>
    axios.get(`/friends/check/${userId}`),

  // Remove friend
  removeFriend: (userId) =>
    axios.delete(`/friends/${userId}/remove`),

  // Get all users (for global contact list)
  getAllUsers: () =>
    axios.get('/users'),

  // ✅ GET SUMMARY (Phase 4 optimization)
  getFriendshipSummary: () =>
    axios.get('/friends/summary'),
};

export default friendAPI;