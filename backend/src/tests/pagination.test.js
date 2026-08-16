import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import Message from '@models/Message.js';
import Group from '@models/Group.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser } from './helpers/otp.js';

describe('🧪 PAGINATION TESTS', () => {
    let userA, userB;
    let tokenA, tokenB;

    beforeAll(async () => {
        await connectDB();
        await User.deleteMany({});
        await Message.deleteMany({});
        await Group.deleteMany({});
        await OTP.deleteMany({});

        // Register User A
        const regA = await registerTestUser(app, {
            name: 'User A', email: 'a@test.com', password: 'Password123!'
        });
        userA = regA.body.data;
        const loginA = await request(app).post('/api/v1/auth/login').send({
            email: 'a@test.com', password: 'Password123!'
        });
        tokenA = loginA.body.token;

        // Register User B
        const regB = await registerTestUser(app, {
            name: 'User B', email: 'b@test.com', password: 'Password123!'
        });
        userB = regB.body.data;
        const loginB = await request(app).post('/api/v1/auth/login').send({
            email: 'b@test.com', password: 'Password123!'
        });
        tokenB = loginB.body.token;
    }, 20000);

    afterAll(async () => {
        await User.deleteMany({});
        await Message.deleteMany({});
        await Group.deleteMany({});
        await OTP.deleteMany({});
    });

    describe('1) Private Chat Pagination', () => {
        it('should paginate messages correctly', async () => {
            // Create 15 messages
            const msgs = [];
            for (let i = 1; i <= 15; i++) {
                msgs.push({
                    senderId: userA._id,
                    receiverId: userB._id,
                    message: `Msg ${i}`,
                    createdAt: new Date(Date.now() - (16 - i) * 60000) // Each 1 min apart
                });
            }
            await Message.insertMany(msgs);

            // Fetch latest 10
            const res1 = await request(app)
                .get(`/api/v1/messages/${userB._id}?limit=10`)
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res1.status).toBe(200);
            expect(res1.body.data.length).toBe(10);
            expect(res1.body.hasMore).toBe(true);
            expect(res1.body.nextCursor).toBeDefined();
            // Latest should be at the end of the array (reverse sort in controller)
            expect(res1.body.data[9].message).toBe('Msg 15');
            expect(res1.body.data[0].message).toBe('Msg 6');

            // Fetch next 10 (which is 5 remaining)
            const res2 = await request(app)
                .get(`/api/v1/messages/${userB._id}?limit=10&before=${res1.body.nextCursor}`)
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res2.status).toBe(200);
            expect(res2.body.data.length).toBe(5);
            expect(res2.body.hasMore).toBe(false);
            expect(res2.body.data[4].message).toBe('Msg 5');
            expect(res2.body.data[0].message).toBe('Msg 1');
        });
    });

    describe('2) Group Chat Pagination', () => {
        it('should paginate group messages correctly', async () => {
            // Groups require members to be friends first
            const sendRes = await request(app)
                .post('/api/v1/friends')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id });
            await request(app)
                .patch(`/api/v1/friends/${sendRes.body.data._id}/accept`)
                .set('Authorization', `Bearer ${tokenB}`);

            // Create a group
            const groupRes = await request(app)
                .post('/api/v1/groups')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ name: 'Test Group', memberIds: [userB._id] });

            const groupId = groupRes.body.data._id;

            // Create 12 messages in group
            const msgs = [];
            for (let i = 1; i <= 12; i++) {
                msgs.push({
                    senderId: userA._id,
                    groupId: groupId,
                    chatType: 'group',
                    message: `Group Msg ${i}`,
                    createdAt: new Date(Date.now() - (13 - i) * 60000)
                });
            }
            await Message.insertMany(msgs);

            // Fetch latest 5
            const res1 = await request(app)
                .get(`/api/v1/groups/${groupId}/messages?limit=5`)
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res1.status).toBe(200);
            expect(res1.body.data.length).toBe(5);
            expect(res1.body.hasMore).toBe(true);
            expect(res1.body.data[4].message).toBe('Group Msg 12');
            expect(res1.body.data[0].message).toBe('Group Msg 8');

            // Fetch next 10 (remaining 7)
            const res2 = await request(app)
                .get(`/api/v1/groups/${groupId}/messages?limit=10&before=${res1.body.nextCursor}`)
                .set('Authorization', `Bearer ${tokenA}`);

            expect(res2.status).toBe(200);
            expect(res2.body.data.length).toBe(7);
            expect(res2.body.hasMore).toBe(false);
            expect(res2.body.data[6].message).toBe('Group Msg 7');
            expect(res2.body.data[0].message).toBe('Group Msg 1');
        });
    });
});
