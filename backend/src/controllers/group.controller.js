import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from '../models/Message.js';
import Friend from "../models/Friend.js";
import mongoose from 'mongoose';
import { sendServerError } from '../utils/errorResponse.js';
import { emitToUser } from '../utils/socketEmit.js';
import { SOCKET_EVENTS } from '../constant/response.messages.js';

//  Validate MongoDB ObjectId (handles both string and ObjectId)
const isValidObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id);
};

//  Convert string to ObjectId if needed
const toObjectId = (id) => {
    if (!id) return null;
    if (typeof id === 'object') return id;  // Already ObjectId
    return mongoose.Types.ObjectId.createFromHexString(id);
};

// create group
export const createGroup = async (req, res) => {
    try {
        const { name, memberIds } = req.body;
        const userId = req.user.userId;  // This is a STRING from auth middleware

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Group name is required"
            });
        }

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one member is required"
            });
        }

        if (memberIds.length > 200) {
            return res.status(400).json({
                success: false,
                message: "A group cannot have more than 200 members"
            });
        }

        const allIds = [...memberIds.map(String), String(userId)];
        for (const id of allIds) {
            if (!isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid user ID format: ${id}`
                });
            }
        }

        const uniqueMemberIds = [...new Set(memberIds.map(String))];
        const userIdStr = String(userId);

        if (!uniqueMemberIds.includes(userIdStr)) {
            uniqueMemberIds.push(userIdStr);
        }

        const members = await User.find({
            _id: { $in: uniqueMemberIds.map(toObjectId) }
        });

        if (members.length !== uniqueMemberIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more members not found"
            });
        }

        if (uniqueMemberIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Group must have at least 2 participants (creator + at least 1 other)"
            });
        }

        const otherMemberIds = uniqueMemberIds.filter(id => id !== userIdStr);

        const friendships = await Friend.find({
            $or: [
                { senderId: userId, receiverId: { $in: otherMemberIds }, status: 'accepted' },
                { receiverId: userId, senderId: { $in: otherMemberIds }, status: 'accepted' }
            ]
        });

        const friendIdsSet = new Set();
        friendships.forEach(f => {
            const friendId = f.senderId.toString() === userIdStr ? f.receiverId.toString() : f.senderId.toString();
            friendIdsSet.add(friendId);
        });

        for (const memberId of otherMemberIds) {
            if (!friendIdsSet.has(memberId)) {
                const memberUser = members.find(m => m._id.toString() === memberId);
                return res.status(403).json({
                    success: false,
                    message: `Cannot add ${memberUser?.name || memberId} to group - you must be friends first`,
                });
            }
        }

        const group = await Group.create({
            name: name.trim(),
            participants: uniqueMemberIds.map(toObjectId),
            adminId: toObjectId(userIdStr)
        });

        await group.populate('participants', 'name email publicKey avatar');
        await group.populate('adminId', 'name email avatar');

        // Notify every invited member (not the creator, who already has the
        // REST response) so the group shows up in their list live instead
        // of only after their next unrelated refetch.
        for (const memberId of otherMemberIds) {
            emitToUser(req, memberId, SOCKET_EVENTS.GROUP_CREATED, {
                groupId: group._id,
                name: group.name,
                adminId: group.adminId._id,
                adminName: group.adminId.name,
                participants: group.participants.map((p) => ({ _id: p._id, name: p.name, email: p.email, avatar: p.avatar || null})),
            });
        }

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: group
        });

    } catch (error) {
        console.error('Create group error:', error.message);
        return sendServerError(res, error, 'Failed to create group');
    }
};

// get my groups
export const getMyGroups = async (req, res) => {
    try {
        const userId = toObjectId(req.user.userId);
        const { skip, limit, page } = req.pagination || { skip: 0, limit: 50, page: 1 };

        const query = { participants: { $in: [userId] } };

        const [groups, total] = await Promise.all([
            Group.find(query)
                .populate('participants', 'name email publicKey avatar _id')
                .populate('adminId', 'name email avatar _id')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Group.countDocuments(query)
        ]);

        const formattedGroups = groups.map(group => ({
            _id: group._id,
            id: group._id,
            name: group.name,
            avatar: group.avatar || null,
            participants: group.participants,
            adminId: group.adminId?._id || group.adminId,
            adminName: group.adminId?.name,
            adminEmail: group.adminId?.email,
            adminAvatar: group.adminId?.avatar || null,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
        }));

        return res.status(200).json({
            success: true,
            data: formattedGroups,
            count: formattedGroups.length,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get groups error:', error.message);
        return sendServerError(res, error, 'Failed to fetch groups');
    }
};

// get single group
export const getGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId)
            .populate('participants', 'name email publicKey avatar _id')
            .populate('adminId', 'name email avatar _id');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (!group.participants.some(p => p._id.toString() === userId.toString())) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const formattedGroup = {
            _id: group._id,
            id: group._id,
            name: group.name,
            avatar: group.avatar || null,
            participants: group.participants,
            members: group.participants,
            adminId: group.adminId?._id || group.adminId,
            adminName: group.adminId?.name,
            adminEmail: group.adminId?.email,
            adminAvatar: group.adminId?.avatar || null,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
        };

        return res.status(200).json({
            success: true,
            data: formattedGroup
        });
    } catch (error) {
        console.error('Get group error:', error.message);
        return sendServerError(res, error, 'Failed to fetch group');
    }
};

// update group avatar (admin only)
export const updateGroupAvatar = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { avatarData } = req.body;
        const userId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.adminId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can change the group picture'
            });
        }

        group.avatar = avatarData;
        await group.save();

        const payload = { groupId: group._id, avatar: group.avatar };
        for (const participantId of group.participants) {
            emitToUser(req, participantId, SOCKET_EVENTS.GROUP_AVATAR_UPDATED, payload);
        }

        return res.status(200).json({
            success: true,
            message: 'Group picture updated successfully',
            data: { avatar: group.avatar }
        });
    } catch (error) {
        console.error('Update group avatar error:', error.message);
        return sendServerError(res, error, 'Failed to update group picture');
    }
};

// remove group avatar (admin only)
export const removeGroupAvatar = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.adminId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can change the group picture'
            });
        }

        group.avatar = null;
        await group.save();

        const payload = { groupId: group._id, avatar: null };
        for (const participantId of group.participants) {
            emitToUser(req, participantId, SOCKET_EVENTS.GROUP_AVATAR_UPDATED, payload);
        }

        return res.status(200).json({
            success: true,
            message: 'Group picture removed successfully',
            data: { avatar: null }
        });
    } catch (error) {
        console.error('Remove group avatar error:', error.message);
        return sendServerError(res, error, 'Failed to remove group picture');
    }
};

// add member to group
export const addMember = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body; 
        const myId = req.user.userId;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        if (!userId || !isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.adminId.toString() !== toObjectId(myId).toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can add members'
            });
        }

        const newMemberObjId = toObjectId(userId);

        const alreadyMember = group.participants.some(
            p => p.toString() === newMemberObjId.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member'
            });
        }

        // createGroup caps membership at 200 (matching the groupCiphertexts
        // schema validator's own 200-member limit) but addMember had no
        // equivalent check — an admin adding members one at a time could
        // push a group past 200, after which every encrypted group message
        // would fail Message.create's validation with no indication why.
        if (group.participants.length >= 200) {
            return res.status(400).json({
                success: false,
                message: 'A group cannot have more than 200 members'
            });
        }

        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const friendship = await Friend.findOne({
            $or: [
                { senderId: myId, receiverId: userId, status: 'accepted' },
                { senderId: userId, receiverId: myId, status: 'accepted' },
            ],
        });

        if (!friendship) {
            return res.status(403).json({
                success: false,
                message: `Cannot add ${userExists.name} - you must be friends first`,
            });
        }


        const updatedGroup = await Group.findByIdAndUpdate(
            groupId,
            { $addToSet: { participants: newMemberObjId } },
            { new: true, runValidators: true }
        )
            .populate('participants', 'name email publicKey avatar')
            .populate('adminId', 'name email avatar');

        // Notify every current member, including the one just added — the
        // new member needs the group to appear in their list; existing
        // members (who may not have this group's chat open, and so aren't
        // in its socket.io room) need their member list to stay accurate.
        const addedPayload = {
            groupId: updatedGroup._id,
            name: updatedGroup.name,
            member: { _id: userExists._id, name: userExists.name, email: userExists.email },
            addedBy: { _id: req.user.userId, name: req.user.name },
            participants: updatedGroup.participants.map((p) => ({ _id: p._id, name: p.name, email: p.email, avatar: p.avatar || null})),
        };
        for (const participant of updatedGroup.participants) {
            emitToUser(req, participant._id, SOCKET_EVENTS.GROUP_MEMBER_ADDED, addedPayload);
        }

        return res.status(200).json({
            success: true,
            message: 'Member added successfully',
            data: updatedGroup
        });

    } catch (error) {
        console.error('Add member error:', error.message);
        return sendServerError(res, error, 'Failed to add member');
    }
};

// remove member from group
export const removeMember = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberId } = req.body;  
        const myId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        if (!memberId || !isValidObjectId(memberId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid member ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.adminId.toString() !== myId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can remove members'
            });
        }

        // An admin removing themselves through this path would leave
        // group.adminId pointing at a non-participant, who could then still
        // fully administer the group (every admin-gated action here checks
        // only group.adminId, never current membership) while being unable
        // to send/read messages in it — and there's no "promote a member"
        // feature, so the group would have no way to ever get a working
        // admin again. leaveGroup already handles this correctly (reassigns
        // to another member, or blocks leaving an otherwise-empty group).
        if (memberId === myId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Admins cannot remove themselves this way — use "Leave Group" instead'
            });
        }

        const memberObjIdToRemove = toObjectId(memberId);

        const memberExists = group.participants.some(
            p => p.toString() === memberObjIdToRemove.toString()
        );

        if (!memberExists) {
            return res.status(400).json({
                success: false,
                message: 'User is not a member of this group'
            });
        }

        const removedUser = await User.findById(memberId).select('name email');

        const updatedGroup = await Group.findByIdAndUpdate(
            groupId,
            { $pull: { participants: memberObjIdToRemove } },
            { new: true, runValidators: true }
        )
            .populate('participants', 'name email publicKey avatar')
            .populate('adminId', 'name email avatar');

        // Notify the removed member specifically (their UI needs to drop
        // the group / exit the chat view if it's open) and everyone still
        // in the group (their member list needs to stay accurate).
        const removedPayload = {
            groupId: updatedGroup._id,
            name: updatedGroup.name,
            member: { _id: memberId, name: removedUser?.name, email: removedUser?.email },
            removedBy: { _id: req.user.userId, name: req.user.name },
            participants: updatedGroup.participants.map((p) => ({ _id: p._id, name: p.name, email: p.email, avatar: p.avatar || null})),
        };
        emitToUser(req, memberId, SOCKET_EVENTS.GROUP_MEMBER_REMOVED, removedPayload);
        for (const participant of updatedGroup.participants) {
            emitToUser(req, participant._id, SOCKET_EVENTS.GROUP_MEMBER_REMOVED, removedPayload);
        }

        return res.status(200).json({
            success: true,
            message: 'Member removed successfully',
            data: updatedGroup
        });

    } catch (error) {
        console.error('Remove member error:', error.message);
        return sendServerError(res, error, 'Failed to remove member');
    }
};

// get group messages
export const getGroupMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);
        const { before } = req.query;
        // The `pagination` middleware (wired on this route) already parses
        // and clamps req.query.limit to [1, 500] — re-parsing it raw here
        // meant that clamp was never applied: `?limit=0` reached
        // `.limit()` as literally 0, which MongoDB/Mongoose treats as "no
        // limit at all" rather than "zero results", so it returned this
        // group's entire message history in one response; `?limit=999999`
        // had no upper cap either.
        const pageSize = req.pagination?.limit || 50;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (!group.participants.some(p => p.toString() === userId.toString())) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const query = {
            groupId: groupId,
            chatType: 'group',
            deleted: { $ne: true }
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .populate('senderId', 'name email _id')
            .populate('readBy.userId', 'name email _id')
            .sort({ createdAt: -1 })
            .limit(pageSize + 1)
            .lean();

        const hasMore = messages.length > pageSize;
        const results = hasMore ? messages.slice(0, pageSize) : messages;

        results.reverse();

        const totalCount = await Message.countDocuments({
            groupId: groupId,
            chatType: 'group',
            deleted: { $ne: true }
        });

        const formattedMessages = results.map(msg => {
            // Encrypted group messages carry one ciphertext per member in
            // groupCiphertexts; hand back only the requester's own entry —
            // matches the shape the client already expects in `message`.
            const messageContent = msg.isEncrypted
                ? (msg.groupCiphertexts?.[userId.toString()] ?? null)
                : msg.message;

            return {
                _id: msg._id,
                fromUserId: msg.senderId._id,
                senderName: msg.senderId.name,
                senderEmail: msg.senderId.email,
                message: messageContent,
                isEncrypted: msg.isEncrypted,
                time: msg.createdAt,
                read: msg.read,
                readBy: msg.readBy ? msg.readBy.map(r => ({
                    userId: r.userId?._id || r.userId,
                    userName: r.userId?.name || 'Unknown',
                    readAt: r.readAt,
                })) : [],
                readCount: msg.readBy?.length || 0,
                chatType: msg.chatType,
                createdAt: msg.createdAt,
                delivered: msg.delivered,
                messageType: msg.messageType || 'text',
                reactions: (msg.reactions || []).map(r => ({ userId: r.userId, emoji: r.emoji })),
                // The imageCiphertext blob itself isn't fanned out per member
                // (see Message.js) — every requester gets the same one, only
                // `message` above (their wrapped content-key) differs.
                ...((msg.messageType === 'image' || msg.messageType === 'video') && {
                    imageCiphertext: msg.imageCiphertext,
                    imageNonce: msg.imageNonce,
                    imageMimeType: msg.imageMimeType
                })
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedMessages,
            count: formattedMessages.length,
            totalCount: totalCount,
            hasMore,
            nextCursor: hasMore ? results[0].createdAt : null, // Oldest in batch
            page: parseInt(req.query.page) || 1, // Keep for backward compat if any
        });
    } catch (error) {
        console.error('Get group messages error:', error.message);
        return sendServerError(res, error, 'Failed to fetch group messages');
    }
};

/**
 * Leave a group
 * 
 * @route POST /api/v1/groups/:groupId/leave
 * @param groupId - Group to leave
 * @access Private (Any member)
 * 
 * Features:
 * - Member can leave any time
 * - Cannot leave if admin and last member (must assign admin first)
 * - Removes user from participants
 * - Returns updated group
 */
export const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const isMember = group.participants.some(
            p => p.toString() === userId.toString()
        );

        if (!isMember) {
            return res.status(400).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const isAdmin = group.adminId.toString() === userId.toString();
        const otherMembers = group.participants.filter(
            p => p.toString() !== userId.toString()
        );

        if (isAdmin && otherMembers.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Admin cannot leave an empty group. Add another admin or delete the group.'
            });
        }

        const update = { $pull: { participants: userId } };
        if (isAdmin && otherMembers.length > 0) {
            update.$set = { adminId: otherMembers[0] };
        }

        // Matching on participants: userId in the filter (not just _id) means
        // this only applies if the user was still a member at update time —
        // avoids a lost-update race with a concurrent leave/removal.
        const updatedGroup = await Group.findOneAndUpdate(
            { _id: groupId, participants: userId },
            update,
            { new: true, runValidators: true }
        )
            .populate('participants', 'name email publicKey avatar')
            .populate('adminId', 'name email avatar');

        if (!updatedGroup) {
            return res.status(400).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Notify the members who are still in the group — the leaver already
        // has their own REST response, and doesn't need this back.
        const leftPayload = {
            groupId: updatedGroup._id,
            name: updatedGroup.name,
            member: { _id: req.user.userId, name: req.user.name },
            newAdminId: updatedGroup.adminId?._id,
            participants: updatedGroup.participants.map((p) => ({ _id: p._id, name: p.name, email: p.email, avatar: p.avatar || null})),
        };
        for (const participant of updatedGroup.participants) {
            emitToUser(req, participant._id, SOCKET_EVENTS.GROUP_MEMBER_LEFT, leftPayload);
        }

        return res.status(200).json({
            success: true,
            message: 'You have left the group successfully',
            data: updatedGroup
        });

    } catch (error) {
        console.error('Leave group error:', error.message);
        return sendServerError(res, error, 'Failed to leave group');
    }
};

/**
 * Delete a group
 * 
 * @route DELETE /api/v1/groups/:groupId
 * @param groupId - Group to delete
 * @access Private (Admin only)
 * 
 * Features:
 * - Only admin can delete group
 * - Deletes all group messages from database
 * - Removes group from database
 * - Returns success message
 */
export const deleteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.adminId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can delete this group'
            });
        }

        const deleteMessagesResult = await Message.deleteMany({
            groupId: groupId,
            chatType: 'group'
        });

        const deletedGroup = await Group.findByIdAndDelete(groupId);

        // Notify former members (the admin already has their own REST
        // response) so their group list / open chat view reacts immediately
        // instead of erroring the next time they try to use it.
        const otherParticipants = deletedGroup.participants.filter(
            (p) => p.toString() !== userId.toString()
        );
        for (const participantId of otherParticipants) {
            emitToUser(req, participantId, SOCKET_EVENTS.GROUP_DELETED, {
                groupId: deletedGroup._id,
                name: deletedGroup.name,
                deletedBy: { _id: req.user.userId, name: req.user.name },
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Group deleted successfully',
            data: {
                groupId: deletedGroup._id,
                groupName: deletedGroup.name,
                messagesDeleted: deleteMessagesResult.deletedCount
            }
        });

    } catch (error) {
        console.error('Delete group error:', error.message);
        return sendServerError(res, error, 'Failed to delete group');
    }
};