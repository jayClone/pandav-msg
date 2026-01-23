import Group from "@models/Group";
import User from "@models/User"
import Message from '@models/Message.js';
import { MESSAGES } from "@constants/response.messages";
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
            .populate('participants', 'name email')
            .populate('adminId', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: groups,
            count: groups.length
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
            .populate('participants', 'name email')
            .populate('adminId', 'name email');

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

        return res.status(200).json({
            success: true,
            data: group
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
export const addMember = async (req, res) =>{
    try {
        const { groupId } = req.params;
        const { userId: newMemberId } = req.body;
        const userId = toObjectId(req.user.userId);

        //  VALIDATE OBJECTID
        if (!isValidObjectId(groupId) || !isValidObjectId(newMemberId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is admin
        if (group.adminId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can add members'
            });
        }

        // Convert to ObjectId for comparison
        const newMemberObjId = toObjectId(newMemberId);

        // Check if already member
        if (group.participants.some(p => p.toString() === newMemberObjId.toString())) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member'
            });            
        }

        // Verify user exists
        const userExists = await User.findById(newMemberObjId);
        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Add member
        group.participants.push(newMemberObjId);
        await group.save();

        await group.populate('participants', 'name email');

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
        const { userId: memberToRemove } = req.body;
        const userId = toObjectId(req.user.userId);

        //  VALIDATE OBJECTID
        if (!isValidObjectId(groupId) || !isValidObjectId(memberToRemove)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
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
        if (group.adminId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can remove members'
            });
        }

        // Convert to ObjectId for comparison
        const memberObjId = toObjectId(memberToRemove);

        // Remove member
        group.participants = group.participants.filter(
            p => p.toString() !== memberObjId.toString()
        );

        await group.save();
        await group.populate('participants', 'name email');

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

        //  VALIDATE OBJECTID
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

        // Fetch messages
        const messages = await Message.find({
            groupId: groupId,
            chatType: 'group'
        })
            .populate('senderId', 'name email')
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count
        const totalCount = await Message.countDocuments({
            groupId: groupId,
            chatType: 'group'
        });

        return res.status(200).json({
            success: true,
            data: messages,
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