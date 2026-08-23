import Friend from '../models/Friend.js';
import { deleteCache } from '../config/redis.js';

// Any change to a user's own profile fields that appear in a friend/summary
// listing (publicKey, avatar, ...) needs to invalidate not just their own
// cached friends list but every friend's cached list too — those entries
// embed a snapshot of this user's data. Originally lived only in
// auth.Controller.js for publicKey changes at login; shared here since
// avatar updates need the exact same invalidation.
export const invalidateFriendGraphCaches = async (userId) => {
  if (!userId) {
    return;
  }

  const userIdStr = userId.toString();
  const friendships = await Friend.find({
    status: 'accepted',
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ]
  })
    .select('senderId receiverId')
    .lean();

  const affectedUserIds = new Set([userIdStr]);

  friendships.forEach((friendship) => {
    const senderId = friendship.senderId?.toString();
    const receiverId = friendship.receiverId?.toString();

    if (senderId) affectedUserIds.add(senderId);
    if (receiverId) affectedUserIds.add(receiverId);
  });

  await Promise.all(
    Array.from(affectedUserIds).flatMap((id) => ([
      deleteCache(`friends:v2:${id}`),
      deleteCache(`friendship:summary:v2:${id}`)
    ]))
  );
};
