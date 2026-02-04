import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, XCircle, Loader } from 'lucide-react';
import friendAPI from '@api/friend.api.js';

export default function FriendRequestModal({ 
  isOpen, 
  onClose, 
  token,
  onFriendRemoved  // ✅ ADD THIS PROP
}) {
  const [allUsers, setAllUsers] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);  // ✅ RECEIVED
  const [sentRequests, setSentRequests] = useState([]);        // ✅ SENT - NEW
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingRequest, setSendingRequest] = useState({});
  const [activeTab, setActiveTab] = useState('contacts');

  // Fetch all data on modal open
  useEffect(() => {
    if (isOpen && token) {
      fetchAllData();
    }
  }, [isOpen, token]);

  const fetchAllData = async () => {
    try {
      setLoadingUsers(true);
      const usersRes = await friendAPI.getAllUsers();
      setAllUsers(usersRes.data.data || []);

      const friendsRes = await friendAPI.getFriends();
      setFriendsList(friendsRes.data.data || []);

      // ✅ Fetch RECEIVED requests
      const pendingRes = await friendAPI.getPendingRequests();
      setPendingRequests(pendingRes.data.data || []);

      // ✅ Fetch SENT requests - NEW
      const sentRes = await friendAPI.getSentRequests();
      setSentRequests(sentRes.data.data || []);

      console.log('✅ Friend data loaded');
    } catch (error) {
      console.error('❌ Error loading friend data:', error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Send friend request
  const handleSendRequest = async (userId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [userId]: true }));
      await friendAPI.sendFriendRequest(userId);
      
      // ✅ Add to SENT requests (not pending)
      setSentRequests(prev => [...prev, {
        _id: `temp-${userId}`,
        senderId: { _id: 'current-user' },
        receiverId: { _id: userId, name: 'User', email: 'user@email.com' }
      }]);

      console.log('✅ Friend request sent');
    } catch (error) {
      console.error('❌ Error sending request:', error.message);
      alert(error.response?.data?.message || 'Failed to send request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Cancel sent request
  const handleCancelRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.rejectFriendRequest(requestId);
      setSentRequests(prev => prev.filter(r => r._id !== requestId));
      console.log('✅ Friend request cancelled');
    } catch (error) {
      console.error('❌ Error cancelling request:', error.message);
      alert('Failed to cancel request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Accept received request
  const handleAcceptRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.acceptFriendRequest(requestId);

      const acceptedRequest = pendingRequests.find(r => r._id === requestId);
      setPendingRequests(prev => prev.filter(r => r._id !== requestId));
      setFriendsList(prev => [...prev, {
        _id: acceptedRequest.senderId._id,
        name: acceptedRequest.senderId.name,
        email: acceptedRequest.senderId.email
      }]);

      console.log('✅ Friend request accepted');
    } catch (error) {
      console.error('❌ Error accepting request:', error.message);
      alert('Failed to accept request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Reject received request
  const handleRejectRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.rejectFriendRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r._id !== requestId));
      console.log('✅ Friend request rejected');
    } catch (error) {
      console.error('❌ Error rejecting request:', error.message);
      alert('Failed to reject request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Remove friend
  const handleRemoveFriend = async (userId) => {
    if (!window.confirm('Remove this friend?')) return;

    try {
      setSendingRequest(prev => ({ ...prev, [userId]: true }));
      await friendAPI.removeFriend(userId);
      setFriendsList(prev => prev.filter(f => f._id !== userId));
      
      // ✅ NOTIFY PARENT - CALL THE CALLBACK
      if (onFriendRemoved) {
        onFriendRemoved(userId);
        console.log('✅ [MODAL] Notified parent about friend removal:', userId);
      }
      
      console.log('✅ Friend removed');
    } catch (error) {
      console.error('❌ Error removing friend:', error.message);
      alert('Failed to remove friend');
    } finally {
      setSendingRequest(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Filter users based on tab and search
  const getFilteredUsers = () => {
    let filtered = allUsers;

    if (activeTab === 'contacts') {
      filtered = allUsers.filter(user => {
        const isFriend = friendsList.some(f => f._id === user._id);
        const hasSentRequest = sentRequests.some(r => r.receiverId._id === user._id);
        return !isFriend && !hasSentRequest;  // ✅ Hide users with sent requests
      });
    } else if (activeTab === 'friends') {
      filtered = friendsList;
    } else if (activeTab === 'pending-received') {
      // ✅ RECEIVED requests
      return pendingRequests.filter(r => {
        const displayName = (r.senderId?.name || r.senderId?.email || '').toString();
        return displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    } else if (activeTab === 'pending-sent') {
      // ✅ SENT requests - NEW
      return sentRequests.filter(r => {
        const displayName = (r.receiverId?.name || r.receiverId?.email || '').toString();
        return displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    }

    return filtered.filter(user => {
      const displayName = user.name || user.email || '';
      return displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const filteredUsers = getFilteredUsers();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[rgb(var(--bg-secondary))] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[rgb(var(--border-secondary))]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgb(var(--border-secondary))]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-green-400" />
            Friends & Contacts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 border-b border-[rgb(var(--border-secondary))] bg-[rgb(var(--bg-primary))] flex-wrap">
          <button
            onClick={() => {
              setActiveTab('contacts');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              activeTab === 'contacts'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            All Contacts
          </button>
          <button
            onClick={() => {
              setActiveTab('friends');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              activeTab === 'friends'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            Friends ({friendsList.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('pending-received');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              activeTab === 'pending-received'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            Received ({pendingRequests.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('pending-sent');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              activeTab === 'pending-sent'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            Sent ({sentRequests.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[rgb(var(--border-secondary))]">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-[rgb(var(--bg-hover))] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-[rgb(var(--border-secondary))]"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="flex items-center justify-center h-40">
              <Loader className="w-8 h-8 text-green-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <p>
                {activeTab === 'contacts' && 'All your contacts are already friends or requests pending!'}
                {activeTab === 'friends' && 'No friends yet'}
                {activeTab === 'pending-received' && 'No pending requests received'}
                {activeTab === 'pending-sent' && 'No pending requests sent'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {activeTab === 'pending-received' ? (
                // ✅ RECEIVED REQUESTS - Accept/Reject
                pendingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center justify-between p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold">
                        {request.senderId?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{request.senderId?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">Sent a request</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request._id)}
                        disabled={sendingRequest[request._id]}
                        className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {sendingRequest[request._id] ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request._id)}
                        disabled={sendingRequest[request._id]}
                        className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              ) : activeTab === 'pending-sent' ? (
                // ✅ SENT REQUESTS - Cancel Only
                sentRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center justify-between p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                        {request.receiverId?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{request.receiverId?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">Pending response</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request._id)}
                      disabled={sendingRequest[request._id]}
                      className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                      {sendingRequest[request._id] ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancel
                    </button>
                  </div>
                ))
              ) : (
                // All Contacts or Friends
                filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    {activeTab === 'contacts' && (
                      <button
                        onClick={() => handleSendRequest(user._id)}
                        disabled={sendingRequest[user._id]}
                        className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {sendingRequest[user._id] ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Add Friend
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === 'friends' && (
                      <button
                        onClick={() => handleRemoveFriend(user._id)}
                        disabled={sendingRequest[user._id]}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 text-sm"
                      >
                        {sendingRequest[user._id] ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}