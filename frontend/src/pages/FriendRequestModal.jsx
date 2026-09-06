import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, XCircle, Loader } from 'lucide-react';
import friendAPI from '@api/friend.api.js';
import { getSocket } from '@socket/socketClient.js';
import { SOCKET_EVENTS } from '@constants/socketEvents.js';

export default function FriendRequestModal({
  isOpen,
  onClose,
  token,
  onFriendRemoved
}) {
  const [allUsers, setAllUsers] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingRequest, setSendingRequest] = useState({});
  const [activeTab, setActiveTab] = useState('contacts');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && token) {
      fetchAllData();
    }
  }, [isOpen, token]);

  // ✅ Real-time: friend requests/accepts/removals used to only show up the
  // next time this modal happened to be reopened. Listen live instead, so
  // it's already up to date whenever the user does open it.
  useEffect(() => {
    if (!token) return;

    let socketInitInterval;
    let cleanup;

    const registerListeners = (socket) => {
      const refresh = () => fetchAllData();

      socket.on(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, refresh);
      socket.on(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
      socket.on(SOCKET_EVENTS.FRIEND_REQUEST_REJECTED, refresh);
      socket.on(SOCKET_EVENTS.FRIEND_REMOVED, refresh);

      return () => {
        socket.off(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, refresh);
        socket.off(SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, refresh);
        socket.off(SOCKET_EVENTS.FRIEND_REQUEST_REJECTED, refresh);
        socket.off(SOCKET_EVENTS.FRIEND_REMOVED, refresh);
      };
    };

    const init = () => {
      const s = getSocket();
      if (s) {
        cleanup = registerListeners(s);
        return true;
      }
      return false;
    };

    if (!init()) {
      socketInitInterval = setInterval(() => {
        if (init()) clearInterval(socketInitInterval);
      }, 100);
    }

    return () => {
      if (socketInitInterval) clearInterval(socketInitInterval);
      if (cleanup) cleanup();
    };
  }, [token]);

  //  AUTO-CLEAR ERRORS
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  //  Close modal on escape key
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const fetchAllData = async () => {
    try {
      setLoadingUsers(true);
      
      //  PHASE 4: Single Aggregated Call (Much faster)
      const res = await friendAPI.getFriendshipSummary();
      const { users, friends, pending, sent } = res.data.data;

      setAllUsers(users.map(user => ({
        _id: user._id,
        name: user.name
      })) || []);

      setFriendsList(friends || []);

      setPendingRequests(pending.map(req => ({
        _id: req._id,
        senderId: {
          _id: req.senderId._id,
          name: req.senderId.name
        }
      })) || []);

      // The summary endpoint already includes this user's own sent
      // requests — without reading it, sentRequests only ever got
      // populated as a side effect of handleSendRequest's own separate
      // getSentRequests() call. That meant: it stayed empty on first
      // open until a NEW request was sent, real-time refreshes (the
      // socket listeners above) never updated it, and — worst — the
      // Cancel button's own fetchAllData() refresh never removed the
      // just-cancelled request from this list, leaving Contacts unable
      // to show that person again (blocked by the same stale entry) and
      // "Sent" showing a phantom entry whose Cancel button now 404s.
      setSentRequests(sent?.map(req => ({
        _id: req._id,
        senderId: {
          _id: req.senderId._id,
          name: req.senderId.name
        },
        receiverId: {
          _id: req.receiverId._id,
          name: req.receiverId.name
        }
      })) || []);

    } catch (err) {
      setError(err.message || 'Failed to load friend data');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [userId]: true }));
      await friendAPI.sendFriendRequest(userId);
      
      //  BEST: Refetch sent requests to get exact backend format
      const sentRes = await friendAPI.getSentRequests();
      setSentRequests(sentRes.data.data?.map(req => ({
        _id: req._id,
        senderId: {
          _id: req.senderId._id,
          name: req.senderId.name
        },
        receiverId: {
          _id: req.receiverId._id,
          name: req.receiverId.name
        }
      })) || []);
      
      setSendingRequest(prev => ({ ...prev, [userId]: false }));
    } catch (err) {
      setError(err.message || 'Failed to send request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.rejectFriendRequest(requestId);
      await fetchAllData(); //  Refetch to get fresh server state
    } catch (err) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.acceptFriendRequest(requestId);
      await fetchAllData(); //  Refetch to get fresh server state
    } catch (err) {
      setError(err.message || 'Failed to accept request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setSendingRequest(prev => ({ ...prev, [requestId]: true }));
      await friendAPI.rejectFriendRequest(requestId);
      await fetchAllData(); //  Refetch to get fresh server state
    } catch (err) {
      setError(err.message || 'Failed to reject request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRemoveFriend = async (userId) => {
    if (!window.confirm('Remove this friend?')) return;

    try {
      setSendingRequest(prev => ({ ...prev, [userId]: true }));
      await friendAPI.removeFriend(userId);
      setFriendsList(prev => prev.filter(f => f._id !== userId));
      
      if (onFriendRemoved) {
        onFriendRemoved(userId);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove friend');
    } finally {
      setSendingRequest(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getFilteredUsers = () => {
    let filtered = allUsers;

    if (activeTab === 'contacts') {
      filtered = allUsers.filter(user => {
        const isFriend = friendsList.some(f => f._id === user._id);
        const hasSentRequest = sentRequests.some(r => r.receiverId._id === user._id);
        return !isFriend && !hasSentRequest;
      });
    } else if (activeTab === 'friends') {
      filtered = friendsList;
    } else if (activeTab === 'pending-received') {
      return pendingRequests.filter(r => {
        const displayName = (r.senderId?.name || 'Unknown').toString();
        return displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    } else if (activeTab === 'pending-sent') {
      return sentRequests.filter(r => {
        const displayName = (r.receiverId?.name || 'Unknown').toString();
        return displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
    }

    return filtered.filter(user => {
      const displayName = user.name || 'Unknown';
      return displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const filteredUsers = getFilteredUsers();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      {/*  RESPONSIVE MODAL */}
      <div className="bg-[rgb(var(--bg-secondary))] rounded-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-[rgb(var(--border-secondary))] shadow-2xl">
        
        {/*  RESPONSIVE HEADER */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-[rgb(var(--border-secondary))] flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 truncate">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0" />
            <span className="hidden sm:inline">Friends & Contacts</span>
            <span className="sm:hidden">Friends</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border-b border-red-500/30 p-2 sm:p-3 text-red-400 text-xs sm:text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
            ⚠️ {error}
          </div>
        )}

        {/*  RESPONSIVE TABS - Scrollable on small screens */}
        <div className="flex gap-1 p-2 sm:p-4 border-b border-[rgb(var(--border-secondary))] bg-[rgb(var(--bg-primary))] overflow-x-auto scrollbar-hide flex-shrink-0">
          <button
            onClick={() => {
              setActiveTab('contacts');
              setSearchQuery('');
            }}
            className={`px-2 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'contacts'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <span className="hidden sm:inline">All Contacts</span>
            <span className="sm:hidden">Contacts</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('friends');
              setSearchQuery('');
            }}
            className={`px-2 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
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
            className={`px-2 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'pending-received'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <span className="hidden sm:inline">Received</span>
            <span className="sm:hidden">In</span> ({pendingRequests.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('pending-sent');
              setSearchQuery('');
            }}
            className={`px-2 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'pending-sent'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <span className="hidden sm:inline">Sent</span>
            <span className="sm:hidden">Out</span> ({sentRequests.length})
          </button>
        </div>

        {/*  RESPONSIVE SEARCH BAR */}
        <div className="p-2 sm:p-4 border-b border-[rgb(var(--border-secondary))] flex-shrink-0">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 bg-[rgb(var(--bg-hover))] text-white text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-[rgb(var(--border-secondary))]"
          />
        </div>

        {/*  RESPONSIVE CONTENT */}
        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="flex items-center justify-center h-40">
              <Loader className="w-8 h-8 text-green-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 px-4 text-center">
              <p className="text-sm sm:text-base">
                {activeTab === 'contacts' && 'All your contacts are already friends or requests pending!'}
                {activeTab === 'friends' && 'No friends yet'}
                {activeTab === 'pending-received' && 'No pending requests received'}
                {activeTab === 'pending-sent' && 'No pending requests sent'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-2 sm:p-4">
              {activeTab === 'pending-received' ? (
                //  RESPONSIVE RECEIVED REQUESTS
                pendingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {request.senderId?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base truncate">{request.senderId?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">Sent a request</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleAcceptRequest(request._id)}
                        disabled={sendingRequest[request._id]}
                        title="Accept friend request"
                        aria-label={`Accept friend request from ${request.senderId?.name || 'Unknown'}`}
                        className="flex-1 sm:flex-none px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        {sendingRequest[request._id] ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Accept</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request._id)}
                        disabled={sendingRequest[request._id]}
                        aria-label={`Reject friend request from ${request.senderId?.name || 'Unknown'}`}
                        className="flex-1 sm:flex-none px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 text-xs sm:text-sm"
                      >
                        <span className="hidden sm:inline">Reject</span>
                        <span className="sm:hidden">Decline</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : activeTab === 'pending-sent' ? (
                //  RESPONSIVE SENT REQUESTS
                sentRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {request.receiverId?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base truncate">{request.receiverId?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">Pending response</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request._id)}
                      disabled={sendingRequest[request._id]}
                      title="Cancel friend request"
                      aria-label={`Cancel friend request to ${request.receiverId?.name || 'Unknown'}`}
                      className="w-full sm:w-auto px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      {sendingRequest[request._id] ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Cancel</span>
                    </button>
                  </div>
                ))
              ) : (
                //  RESPONSIVE ALL CONTACTS OR FRIENDS
                filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-[rgb(var(--bg-hover))] rounded-lg border border-[rgb(var(--border-secondary))] hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <p className="text-white font-medium text-sm sm:text-base truncate">{user.name}</p>
                    </div>

                    {/*  RESPONSIVE ACTION BUTTON */}
                    {activeTab === 'contacts' && (
                      <button
                        onClick={() => handleSendRequest(user._id)}
                        disabled={sendingRequest[user._id]}
                        aria-label={sendingRequest[user._id] ? `Sending friend request to ${user.name}` : `Add ${user.name} as a friend`}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        {sendingRequest[user._id] ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">Sending...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Friend</span>
                            <span className="sm:hidden">Add</span>
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === 'friends' && (
                      <button
                        onClick={() => handleRemoveFriend(user._id)}
                        disabled={sendingRequest[user._id]}
                        aria-label={`Remove ${user.name} from friends`}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 text-xs sm:text-sm"
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