import Group from "@models/Group";
import User from "@models/User"
import Message from '@models/Message.js';
import { MESSAGES } from "@constants/response.messages";

// creat group
export const createGroup = async (req, res) => {
    try {
        const {name, memberIds} = req.body;
        const userId = req.user.userId

    //validate
    if(!name || name.trim().length === 0){
        return res.status(400).json({
            success: false,
            message: "Group name is required"
        });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0){
        return res.status(400).json({
        success: false,
        message: "atleast one member is required"
        });
    }

    // remove duplicates
    const uniqueMemberIds = [...new Set(memberIds)];

    // add creator (logged-in User)
    if (!uniqueMemberIds.includes(userId)){
        uniqueMemberIds.push(userId);
    }

    // validate all members exist 
    const members = await User.find({_id: {$in: uniqueMemberIds}});
    if (members.length !== uniqueMemberIds.length){
        return res.status(400).json({
        success: false,
        message: "one or more members not found"
        });
    }

    // create Group
    const group = await Group.create({
        name: name.trim(),
        participants: uniqueMemberIds,
        adminId: userId
    });

    // populate participants
    await group.populate('participants', 'name email');
    await group.populate('adminId', 'name email')

    return res.status(201).json({
        success: true,
        message: "Group created successfully",
        data: group
    })
    }
    catch (error){
        console.error('Create group error', error.message);
            return res.status(500).json({
            success: false,
            message: "Failed to create group",
            error: error.message
        });
    }
};

// get my group
export const getMyGroups = async(req, res) =>{
    try {
        const userId = req.user.userId;

        // find group where user is participant
        const group = await Group.find({
            participants: { $in: [userId]}
        })
            .populate('participants', 'name email')
            .populate('adminId', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: group,
            count: group.length
        });
    } catch (error) {
        console.error('Get group error:', error.message);
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
        const {groupId} = req.params;
        const userId = req.user.userId;

        const group = await Group.findById(groupId)
            .populate('participants', 'name email')
            .populate('adminId', 'name email');
        
            if(!group) {
              return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
            }

            // check if user is participant
            if (!group.participants.some(p => p._id.toString() === userId)) {
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

// add members to group
export const addMember = async (req, res) =>{
    try {
        const { groupId } = req.params;
        const { userId: newMemberId } = req.body;
        const userId = req.user.userId;

        const group = await Group.findById(groupId)

        if (!group) {
            return res.status(404).json({
            success: false,
            message: 'Group not found'
        });
        }

        // check if user is admin
        if (group.adminId.toString() !== userId) {
            return res.status(403).json({
            success: false,
            message: 'Only admin can add members'
            });
        }

        // check if alrady member
        if(group.participants.includes(newMemberId)){
            return res.status(400).json({
                success: false,
                message: 'User is already a member'
            });            
        }

        // add member
        group.participants.push(newMemberId);
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
    const userId = req.user.userId;

    const group = await Group.findById(groupId);

    if (!group){
        return res.status(404).json({
        success: false,
        message: 'Group not found'
      });    
    }

    // check if user is admin
    if (group.adminId.toString() !== adminId){
        return res.status(403).json({
        success: false,
        message: 'Only admin can remove members'
      });
    }

    // remove member
    group.participants = group.participants.filter(
        p => p.toString() !== memberToRemove
    );

    await group.save();

    await group.populate('participants', 'name email')

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
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    //  Check if user is member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    //  Fetch messages
    const messages = await Message.find({
      groupId: groupId,
      chatType: 'group'
    })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    //  Get total count
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