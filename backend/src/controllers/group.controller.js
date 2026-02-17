import Group from "../models/Group";
import User from "../models/User"
import Message from '../models/Message.js';
import Friend from "../models/Friend";
import mongoose from 'mongoose';  // ✅ ADD THIS

// HELPER: Validate MongoDB ObjectId (handles both string and ObjectId)
const isValidObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id);
};

// HELPER: Convert string to ObjectId if needed
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

        //  VALIDATE NAME
        if(!name || name.trim().length === 0){
            return res.status(400).json({
                success: false,
                message: "Group name is required"
            });
        }

        //  VALIDATE MEMBERS PROVIDED
        if (!Array.isArray(memberIds) || memberIds.length === 0){
            return res.status(400).json({
                success: false,
                message: "At least one member is required"
            });
        }

        //  VALIDATE ALL IDs ARE VALID OBJECTIDS (as strings)
        const allIds = [...memberIds.map(String), String(userId)];
        for (const id of allIds) {
            if (!isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid user ID format: ${id}`
                });
            }
        }

        //  REMOVE DUPLICATES (as strings for comparison)
        const uniqueMemberIds = [...new Set(memberIds.map(String))];
        const userIdStr = String(userId);

        //  AUTO-ADD CREATOR IF NOT ALREADY INCLUDED
        if (!uniqueMemberIds.includes(userIdStr)) {
            uniqueMemberIds.push(userIdStr);
        }

        //  VALIDATE ALL MEMBERS EXIST IN DB
        const members = await User.find({
            _id: { $in: uniqueMemberIds.map(toObjectId) }
        });

        if (members.length !== uniqueMemberIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more members not found"
            });
        }

        //  VERIFY GROUP HAS AT LEAST 2 PARTICIPANTS
        if (uniqueMemberIds.length < 2){
            return res.status(400).json({
                success: false,
                message: "Group must have at least 2 participants (creator + at least 1 other)"
            });
        }

        // CHECK IF ALL MEMBERS ARE FRIENDS WITH CREATOR
        console.log(`🔐 [FRIEND CHECK] Validating group members are friends with creator`);
        
        for (const memberId of uniqueMemberIds) {
            // Skip the creator themselves
            if (memberId === userIdStr) {
                continue;
            }

            // Check if creator is friends with this member
            const friendship = await Friend.findOne({
                $or: [
                    { senderId: userId, receiverId: memberId, status: 'accepted' },
                    { senderId: memberId, receiverId: userId, status: 'accepted' },
                ],
            });

            if (!friendship) {
                const memberUser = members.find(m => m._id.toString() === memberId);
                return res.status(403).json({
                    success: false,
                    message: `Cannot add ${memberUser?.name || memberId} to group - you must be friends first`,
                });
            }
        }

        console.log(`✅ [FRIEND CHECK] All members are friends with creator`);

        //  CREATE GROUP WITH VALIDATED DATA
        const group = await Group.create({
            name: name.trim(),
            participants: uniqueMemberIds.map(toObjectId),
            adminId: toObjectId(userIdStr)
        });

        //  POPULATE RESPONSE
        await group.populate('participants', 'name email');
        await group.populate('adminId', 'name email');

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: group
        });

    } catch (error){
        console.error('Create group error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to create group",
            error: error.message
        });
    }
};

// get my groups
export const getMyGroups = async(req, res) =>{
    try {
        const userId = toObjectId(req.user.userId);

        // Find groups where user is participant
        const groups = await Group.find({
            participants: { $in: [userId]}
        })
            .populate('participants', 'name email _id')
            .populate('adminId', 'name email _id')  // ✅ CRITICAL: Populate admin
            .sort({ createdAt: -1 });

        // ✅ ENSURE adminId IS IN RESPONSE
        const formattedGroups = groups.map(group => ({
            _id: group._id,
            id: group._id,
            name: group.name,
            participants: group.participants,
            adminId: group.adminId?._id || group.adminId,  // ✅ Include adminId
            adminName: group.adminId?.name,  // ✅ Include admin name
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
export const getGroup = async (req, res) =>{
    try {
        const { groupId } = req.params;
        const userId = toObjectId(req.user.userId);

        // ✅ VALIDATE OBJECTID
        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        const group = await Group.findById(groupId)
            .populate('participants', 'name email _id')
            .populate('adminId', 'name email _id');  // ✅ CRITICAL: Populate admin

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is participant
        if (!group.participants.some(p => p._id.toString() === userId.toString())) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // ✅ FORMAT RESPONSE WITH ADMIN INFO
        const formattedGroup = {
            _id: group._id,
            id: group._id,
            name: group.name,
            participants: group.participants,
            members: group.participants,  // Alias for frontend
            adminId: group.adminId?._id || group.adminId,  // ✅ Include adminId
            adminName: group.adminId?.name,  // ✅ Include admin name
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
export const addMember = async(req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;  // ✅ Receive 'userId' from frontend
        const myId = req.user.userId;

        // VALIDATE OBJECTID
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

        if (!group){
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });    
        }

        // Check if user is admin
        if (group.adminId.toString() !== toObjectId(myId).toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can add members'
            });
        }

        // Convert to ObjectId for comparison
        const newMemberObjId = toObjectId(userId);

        // Check if user already exists
        const alreadyMember = group.participants.some(
            p => p.toString() === newMemberObjId.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member'
            });
        }

        // Check if user exists in DB
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // ✅ NEW: CHECK IF ADMIN IS FRIENDS WITH NEW MEMBER
        console.log(`🔐 [FRIEND CHECK] Verifying admin is friends with new member`);
        
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

        console.log(`✅ [FRIEND CHECK] Admin is friends with new member`);


        // Add member
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
export const removeMember = async(req, res) => {
    try {
        const { groupId } = req.params;
        const { memberId } = req.body;  // ✅ CONSISTENT: Use singular 'memberId'
        const myId = toObjectId(req.user.userId);

        //  VALIDATE OBJECTID
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

        if (!group){
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });    
        }

        // Check if user is admin
        if (group.adminId.toString() !== myId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can remove members'
            });
        }

        // ✅ FIX: Convert to ObjectId for comparison
        const memberObjIdToRemove = toObjectId(memberId);

        // ✅ FIX: Check if member actually exists in group
        const memberExists = group.participants.some(
            p => p.toString() === memberObjIdToRemove.toString()
        );

        if (!memberExists) {
            return res.status(400).json({
                success: false,
                message: 'User is not a member of this group'
            });
        }

        // ✅ FIX: Remove member using correct variable name
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // VALIDATE OBJECTID
        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID format'
            });
        }

        // Check if user is member
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

        // ✅ FETCH MESSAGES WITH readBy POPULATED
        const messages = await Message.find({
            groupId: groupId,
            chatType: 'group',
            deleted: { $ne: true }  // Exclude soft-deleted messages
        })
            .populate('senderId', 'name email _id')
            .populate('readBy.userId', 'name email _id')  // ✅ CRITICAL: Populate readBy
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count
        const totalCount = await Message.countDocuments({
            groupId: groupId,
            chatType: 'group',
            deleted: { $ne: true }
        });

        // ✅ FORMAT RESPONSE WITH PROPER readBy DATA
        const formattedMessages = messages.map(msg => ({
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
            })) : [],  // ✅ RETURN readBy ARRAY
            readCount: msg.readBy?.length || 0,  // ✅ ADD readCount
            chatType: msg.chatType,
            createdAt: msg.createdAt,
            delivered: msg.delivered,
        }));

        return res.status(200).json({
            success: true,
            data: formattedMessages,
            count: messages.length,
            totalCount: totalCount,
            page: page,
            totalPages: Math.ceil(totalCount / limit)
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

    // ✅ VALIDATE OBJECTID
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

    // ✅ CHECK: User is member
    const isMember = group.participants.some(
      p => p.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // ✅ CHECK: Admin cannot leave if only admin (prevent orphaned groups)
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

    // ✅ REMOVE USER FROM GROUP
    group.participants = group.participants.filter(
      p => p.toString() !== userId.toString()
    );

    // ✅ IF ADMIN LEFT, REASSIGN ADMIN TO FIRST REMAINING MEMBER
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

    // ✅ VALIDATE OBJECTID
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

    // ✅ CHECK: User is admin
    if (group.adminId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete this group'
      });
    }

    // ✅ DELETE ALL MESSAGES IN THIS GROUP
    const deleteMessagesResult = await Message.deleteMany({
      groupId: groupId,
      chatType: 'group'
    });

    console.log(`🗑️ Deleted ${deleteMessagesResult.deletedCount} messages from group ${groupId}`);

    // ✅ DELETE THE GROUP
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