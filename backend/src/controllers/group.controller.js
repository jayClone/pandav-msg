import Group from "../models/Group";
import User from "../models/User"
import Message from '../models/Message.js';
import Friend from "../models/Friend";
import mongoose from 'mongoose';  

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

        await group.populate('participants', 'name email');
        await group.populate('adminId', 'name email');

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: group
        });

    } catch (error) {
        console.error('Create group error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to create group",
            error: error.message
        });
    }
};

// get my groups
export const getMyGroups = async (req, res) => {
    try {
        const userId = toObjectId(req.user.userId);

        const groups = await Group.find({
            participants: { $in: [userId] }
        })
            .populate('participants', 'name email _id')
            .populate('adminId', 'name email _id')  
            .sort({ createdAt: -1 });

        const formattedGroups = groups.map(group => ({
            _id: group._id,
            id: group._id,
            name: group.name,
            participants: group.participants,
            adminId: group.adminId?._id || group.adminId,  
            adminName: group.adminId?.name, 
            adminEmail: group.adminId?.email,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
        }));

        return res.status(200).json({
            success: true,
            data: formattedGroups,
            count: formattedGroups.length
        });
    } catch (error) {
        console.error('Get groups error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch groups',
            error: error.message
        });
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
            .populate('participants', 'name email _id')
            .populate('adminId', 'name email _id');  

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
            participants: group.participants,
            members: group.participants,  
            adminId: group.adminId?._id || group.adminId, 
            adminName: group.adminId?.name, 
            adminEmail: group.adminId?.email,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
        };

        return res.status(200).json({
            success: true,
            data: formattedGroup
        });
    } catch (error) {
        console.error('Get group error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch group',
            error: error.message
        });
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


        group.participants.push(newMemberObjId);
        await group.save();
        await group.populate('participants', 'name email');
        await group.populate('adminId', 'name email');

        return res.status(200).json({
            success: true,
            message: 'Member added successfully',
            data: group
        });

    } catch (error) {
        console.error('Add member error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to add member',
            error: error.message
        });
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

        group.participants = group.participants.filter(
            p => p.toString() !== memberObjIdToRemove.toString()
        );

        await group.save();
        await group.populate('participants', 'name email');
        await group.populate('adminId', 'name email');

        return res.status(200).json({
            success: true,
            message: 'Member removed successfully',
            data: group
        });

    } catch (error) {
        console.error('Remove member error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove member',
            error: error.message
        });
    }
};

// get group messages
export const getGroupMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);
        const { before, limit = 50 } = req.query;
        const pageSize = parseInt(limit);

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

        const formattedMessages = results.map(msg => ({
            _id: msg._id,
            fromUserId: msg.senderId._id,
            senderName: msg.senderId.name,
            senderEmail: msg.senderId.email,
            message: msg.message,
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
        }));

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
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch group messages',
            error: error.message
        });
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

        group.participants = group.participants.filter(
            p => p.toString() !== userId.toString()
        );

        if (isAdmin && group.participants.length > 0) {
            group.adminId = group.participants[0];
        }

        await group.save();
        await group.populate('participants', 'name email');
        await group.populate('adminId', 'name email');

        return res.status(200).json({
            success: true,
            message: 'You have left the group successfully',
            data: group
        });

    } catch (error) {
        console.error('Leave group error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to leave group',
            error: error.message
        });
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
        return res.status(500).json({
            success: false,
            message: 'Failed to delete group',
            error: error.message
        });
    }
};