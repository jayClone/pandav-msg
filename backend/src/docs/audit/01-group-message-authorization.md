# 01 — Group message authorization

**Severity:** Blocker
**Source:** security-engineer + backend-architect (independently, same finding)
**Status:** ✅ fixed and live-verified (2026-08-15)

## What's wrong

Neither the REST endpoint nor the Socket.IO handler for sending a group message checks that the sender is actually a participant of the group.

- `backend/src/controllers/message.controller.js:387-429` — `sendGroupMessage`, route `POST /api/v1/messages/group`
- `backend/src/socket/handlers/group-message.handler.js:8-46` — `handleGroupMessage`, socket event `group_message`

Every other group operation in the codebase checks membership first:

- `getGroup`, `getGroupMessages`, `markGroupMessagesAsRead`, `addMember`, `removeMember`, `leaveGroup`, `deleteGroup` in `group.controller.js`
- `handleJoinGroup` in `backend/src/socket/handlers/group-room.handler.js` (`group.participants.some(p => p.toString() === userId)`)

The two send-message paths are the only ones that skip it.

## Impact

Any authenticated user who can guess or observe a `groupId` (Mongo ObjectIds are sequential/enumerable) can permanently persist a message into a group they were never added to, and have it broadcast live to every real member — full integrity break of group chat, plus a spam/harassment/phishing vector.

## Fix — applied

Added the same membership check used everywhere else, in both places, before `Message.create`:

- `backend/src/controllers/message.controller.js` — `sendGroupMessage` now validates the `groupId` format, loads the `Group` (404 if missing), and checks `group.participants.some(p => p.toString() === senderId.toString())` before creating the message — returns 403 `"You are not a member of this group"` otherwise.
- `backend/src/socket/handlers/group-message.handler.js` — `handleGroupMessage` now imports `Group`, loads it, and runs the same membership check before `Message.create` — emits `error_message` (`SOCKET_EVENTS.ERROR_MESSAGE`) with `"User is not a member of this group"` and returns otherwise, matching the pattern already used in `handleJoinGroup` (`group-room.handler.js`).

## Verify

- [x] As a user who is **not** a member of a group, `POST /api/v1/messages/group` with that `groupId` → 403 `"You are not a member of this group"`, confirmed live against a running server (previously 201).
- [x] Same test over the socket `group_message` event → confirmed live: non-member gets an `error_message` emit (`"User is not a member of this group"`), and zero `Message` documents are persisted for the attempt.
- [x] As an actual member, sending still works normally over both REST and socket — confirmed live, no regression.
- [ ] Add a permanent regression test to `backend/src/tests/group.test.js` — deferred to [09 — Test suite fixes](09-test-suite.md), since that file's registration helper is currently broken (stale OTP flow) and can't reliably register the two test users needed for this case yet.
