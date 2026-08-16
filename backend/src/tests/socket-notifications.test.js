import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import Friend from '@models/Friend.js';
import Group from '@models/Group.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser } from './helpers/otp.js';
import { SOCKET_EVENTS } from '@constants/response.messages.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧪 SOCKET NOTIFICATIONS — friend & group mutations
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Friend-request and group-membership REST mutations used to be silent —
 * no live notification to anyone but the actor. This verifies each mutation
 * now emits the right event, to the right room(s), with the actor's own
 * personal-room emit correctly excluded/included per the real semantics.
 *
 * `req.app.get('io')` is how these controllers reach Socket.IO (see
 * utils/socketEmit.js) — attach a lightweight recording fake here rather
 * than standing up a real Socket.IO server.
 */
function createMockIo() {
  const calls = [];
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          calls.push({ room: room.toString(), event, payload });
        },
      };
    },
  };
  return { io, calls };
}

describe('🧪 SOCKET NOTIFICATIONS', () => {
  let mockIo;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Friend.deleteMany({});
    await Group.deleteMany({});
    await OTP.deleteMany({});
  }, 20000);

  beforeEach(() => {
    mockIo = createMockIo();
    app.set('io', mockIo.io);
  });

  afterAll(async () => {
    app.set('io', undefined);
    await User.deleteMany({});
    await Friend.deleteMany({});
    await Group.deleteMany({});
    await OTP.deleteMany({});
    // Deliberately not calling disconnectDB() — see docs/audit/09.
  });

  const findEmit = (calls, event) => calls.find((c) => c.event === event);

  describe('A) Friend-request events', () => {
    let sender, senderToken, receiver, receiverToken;

    beforeAll(async () => {
      const senderRes = await registerTestUser(app, { name: 'Notif Sender', email: 'notif-sender@example.com', password: 'SecurePass123!' });
      const receiverRes = await registerTestUser(app, { name: 'Notif Receiver', email: 'notif-receiver@example.com', password: 'SecurePass123!' });
      sender = senderRes.body.data;
      senderToken = senderRes.body.token;
      receiver = receiverRes.body.data;
      receiverToken = receiverRes.body.token;
    }, 20000);

    let requestId;

    it('sendFriendRequest emits FRIEND_REQUEST_RECEIVED to the receiver only', async () => {
      const res = await request(app)
        .post('/api/v1/friends')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ receiverId: receiver._id })
        .timeout(15000);

      expect(res.status).toBe(201);
      requestId = res.body.data._id;

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(receiver._id.toString());
      expect(emitted.payload.senderId).toBe(sender._id.toString());
      expect(mockIo.calls.some((c) => c.room === sender._id.toString())).toBe(false);
    });

    it('acceptFriendRequest emits FRIEND_REQUEST_ACCEPTED to the original sender only', async () => {
      const res = await request(app)
        .patch(`/api/v1/friends/${requestId}/accept`)
        .set('Authorization', `Bearer ${receiverToken}`)
        .timeout(15000);

      expect(res.status).toBe(200);

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(sender._id.toString());
      expect(emitted.payload.friendId).toBe(receiver._id.toString());
      expect(mockIo.calls.some((c) => c.room === receiver._id.toString())).toBe(false);
    });

    it('removeFriend emits FRIEND_REMOVED to the other friend only', async () => {
      const res = await request(app)
        .delete(`/api/v1/friends/${receiver._id}/remove`)
        .set('Authorization', `Bearer ${senderToken}`)
        .timeout(15000);

      expect(res.status).toBe(200);

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.FRIEND_REMOVED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(receiver._id.toString());
      expect(emitted.payload.byUserId).toBe(sender._id.toString());
    });

    it('rejectFriendRequest (cancel) emits FRIEND_REQUEST_REJECTED to whichever side did not act', async () => {
      const sendRes = await request(app)
        .post('/api/v1/friends')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ receiverId: receiver._id })
        .timeout(15000);
      const newRequestId = sendRes.body.data._id;

      mockIo = createMockIo();
      app.set('io', mockIo.io);

      // sender cancels their own pending request -> receiver gets notified
      const res = await request(app)
        .delete(`/api/v1/friends/${newRequestId}`)
        .set('Authorization', `Bearer ${senderToken}`)
        .timeout(15000);

      expect(res.status).toBe(200);

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.FRIEND_REQUEST_REJECTED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(receiver._id.toString());
      expect(emitted.payload.byUserId).toBe(sender._id.toString());
    });
  });

  describe('B) Group-membership events', () => {
    let admin, adminToken, member, memberToken, outsider, outsiderToken;
    let groupId;

    beforeAll(async () => {
      const adminRes = await registerTestUser(app, { name: 'Notif Admin', email: 'notif-admin@example.com', password: 'SecurePass123!' });
      const memberRes = await registerTestUser(app, { name: 'Notif Member', email: 'notif-member@example.com', password: 'SecurePass123!' });
      const outsiderRes = await registerTestUser(app, { name: 'Notif Outsider', email: 'notif-outsider@example.com', password: 'SecurePass123!' });
      admin = adminRes.body.data;
      adminToken = adminRes.body.token;
      member = memberRes.body.data;
      memberToken = memberRes.body.token;
      outsider = outsiderRes.body.data;
      outsiderToken = outsiderRes.body.token;

      // Groups require friendship between creator and every invited member.
      for (const [token, otherId] of [[adminToken, member._id], [adminToken, outsider._id]]) {
        const sendRes = await request(app)
          .post('/api/v1/friends')
          .set('Authorization', `Bearer ${token}`)
          .send({ receiverId: otherId })
          .timeout(15000);
        const otherToken = otherId === member._id ? memberToken : outsiderToken;
        await request(app)
          .patch(`/api/v1/friends/${sendRes.body.data._id}/accept`)
          .set('Authorization', `Bearer ${otherToken}`)
          .timeout(15000);
      }
    }, 30000);

    it('createGroup emits GROUP_CREATED to invited members, not the creator', async () => {
      mockIo = createMockIo();
      app.set('io', mockIo.io);

      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Notif Test Group', memberIds: [member._id] })
        .timeout(15000);

      expect(res.status).toBe(201);
      groupId = res.body.data._id;

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.GROUP_CREATED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(member._id.toString());
      expect(mockIo.calls.some((c) => c.room === admin._id.toString())).toBe(false);
    });

    it('addMember emits GROUP_MEMBER_ADDED to every current participant, including the new one', async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: outsider._id })
        .timeout(15000);

      expect(res.status).toBe(200);

      const emittedRooms = mockIo.calls
        .filter((c) => c.event === SOCKET_EVENTS.GROUP_MEMBER_ADDED)
        .map((c) => c.room);

      expect(emittedRooms).toContain(admin._id.toString());
      expect(emittedRooms).toContain(member._id.toString());
      expect(emittedRooms).toContain(outsider._id.toString());
    });

    it('removeMember emits GROUP_MEMBER_REMOVED to the removed member and everyone remaining', async () => {
      mockIo = createMockIo();
      app.set('io', mockIo.io);

      const res = await request(app)
        .delete(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberId: outsider._id })
        .timeout(15000);

      expect(res.status).toBe(200);

      const emittedRooms = mockIo.calls
        .filter((c) => c.event === SOCKET_EVENTS.GROUP_MEMBER_REMOVED)
        .map((c) => c.room);

      expect(emittedRooms).toContain(outsider._id.toString()); // the removed member
      expect(emittedRooms).toContain(admin._id.toString());
      expect(emittedRooms).toContain(member._id.toString());
    });

    it('leaveGroup emits GROUP_MEMBER_LEFT to the members who remain', async () => {
      mockIo = createMockIo();
      app.set('io', mockIo.io);

      const res = await request(app)
        .post(`/api/v1/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .timeout(15000);

      expect(res.status).toBe(200);

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.GROUP_MEMBER_LEFT);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(admin._id.toString());
    });

    it('deleteGroup emits GROUP_DELETED to former members other than the admin', async () => {
      // Re-add member so there's someone besides the admin to notify.
      await request(app)
        .post(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: member._id })
        .timeout(15000);

      mockIo = createMockIo();
      app.set('io', mockIo.io);

      const res = await request(app)
        .delete(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .timeout(15000);

      expect(res.status).toBe(200);

      const emitted = findEmit(mockIo.calls, SOCKET_EVENTS.GROUP_DELETED);
      expect(emitted).toBeDefined();
      expect(emitted.room).toBe(member._id.toString());
      expect(mockIo.calls.some((c) => c.room === admin._id.toString())).toBe(false);
    });
  });
});
