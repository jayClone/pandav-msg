import Message from '@models/Message.js';
import Group from '@models/Group.js';

export async function handleReadReceipt(socket, io, payload, userId, name) {
  try {
    const { messageId, groupId } = payload;

    console.log(`\n📖 [READ RECEIPT] Processing`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Group ID: ${groupId || 'Private'}`);
    console.log(`   User: ${name} (${userId})`);
    console.log(`   Socket: ${socket.id}`);

    if (!messageId) {
      console.error('❌ Missing messageId');
      return;
    }

    // ✅ FETCH MESSAGE
    const message = await Message.findById(messageId);

    if (!message) {
      console.error('❌ Message not found:', messageId);
      return;
    }

    // ✅ CRITICAL FIX: Verify the user reading is the RECEIVER, not sender
    console.log(`[CHECK] Sender: ${message.senderId}, Reader: ${userId}`);
    
    if (message.senderId.toString() === userId.toString()) {
      console.log('⚠️  Sender cannot mark their own message as read');
      return;  // ✅ FIX: Sender should NOT mark as read
    }

    // ✅ CHECK: Already marked as read by this user
    const userAlreadyRead = message.readBy?.some(
      (r) => r.userId?.toString() === userId.toString()
    );

    if (userAlreadyRead) {
      console.log('⚠️  User already marked as read');
      return;
    }

    console.log('✅ [1/3] Validation passed');

    // ✅ UPDATE MESSAGE IN DB
    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      {
        $push: {
          readBy: {
            userId: userId,
            readAt: new Date(),
          },
        },
        read: true,
        delivered: true,
      },
      { new: true }
    ).populate('readBy.userId', 'name email _id');

    console.log(`✅ [2/3] Message saved to DB - Read by: ${updatedMessage.readBy.length}`);

    // ✅ FORMAT RESPONSE DATA
    const readReceiptData = {
      messageId: messageId,
      userId: userId,
      userName: name,
      readAt: new Date(),
      readBy: updatedMessage.readBy.map((r) => ({
        userId: r.userId?._id || r.userId,
        userName: r.userId?.name || name,
        readAt: r.readAt,
      })),
      readCount: updatedMessage.readBy.length,
    };

    console.log(`✅ [3/3] Broadcasting read receipt to:`);

    // ✅ BROADCAST TO ALL CONNECTIONS
    if (groupId) {
      console.log(`   📤 GROUP: ${groupId}`);
      readReceiptData.groupId = groupId;
      io.to(groupId.toString()).emit('message_read', readReceiptData);
    } else {
      console.log(`   📤 TO SENDER: ${message.senderId}`);
      io.to(message.senderId.toString()).emit('message_read', readReceiptData);
    }

    console.log(`✅ Read receipt completed\n`);

  } catch (error) {
    console.error('❌ [ERROR] Read receipt handler failed:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  }
}