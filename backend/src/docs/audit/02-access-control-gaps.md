# 02 — Access control gaps (IDOR)

**Severity:** High
**Source:** security-engineer, backend-architect
**Status:** ✅ 2.1–2.3 fixed and live-verified (2026-08-15) · 2.4 closed, no change needed

Four separate missing-authorization findings, grouped because they're all "an authenticated user can act on/see data that isn't theirs."

---

## 2.1 — Anyone can delete anyone's message over the socket path ✅ fixed

`backend/src/socket/handlers/message-deleted.handler.js` now loads the message first, compares `senderId` to the requesting user, and emits `error_message` (`"you can only delete your own message"`) instead of deleting when it doesn't match — mirrors the REST controller's check exactly.

**Verify:**
- [x] User A can't delete User B's message via the socket `message_deleted` event — confirmed live: non-owner gets `error_message`, message remains in the database.
- [x] User A can still delete their own message via socket — confirmed live, no regression.

---

## 2.2 — Anyone can read who has seen a message they're not part of ✅ fixed

`backend/src/controllers/message.controller.js` — `getMessageReadReceipts` (route `GET /api/v1/messages/:messageId/read-receipts`) now checks the requester is a participant (sender/receiver for private, group member via `Group.findById` for group) before returning `readBy`, and returns 403 `"Not authorized to view this message"` otherwise.

**Verify:**
- [x] A user with no relationship to a message's sender/receiver/group gets 403 on `GET /messages/:messageId/read-receipts` — confirmed live.
- [x] The actual sender still gets the correct data — confirmed live (empty `readBy` since no one had read it yet, but request succeeded with 200).

---

## 2.3 — Private messaging bypasses the friend-only model over REST ✅ fixed

`backend/src/controllers/message.controller.js` — `sendPrivateMessage` now validates `receiverId` format, confirms the recipient exists (404 if not), and requires an accepted `Friend` record between sender and receiver (403 `"Cannot message non-friends"` otherwise) before creating the message — matching the check already enforced on the socket path.

**Verify:**
- [x] REST `POST /messages/private` to a non-friend → 403 `"Cannot message non-friends"` — confirmed live (previously 201).
- [x] REST `POST /messages/private` to a nonexistent user id → 404 `"Recipient user not found"`, not 500 — confirmed live.
- [x] Messaging an actual friend still works — confirmed live after creating an accepted friendship, no regression.

---

## 2.4 — Any authenticated user can harvest every registered email — ✅ closed, no change needed

`backend/src/controllers/user.controller.js` — `getAllUsers`, `getUserProfile`, `searchUsers` all return raw `email` for any user id to any authenticated caller.

**Resolution:** checked the frontend before flagging this as a fix. `frontend/src/pages/Chat.jsx:284` shows the client depends on every listed user's `email` to derive their E2EE public key locally (`derivePublicKeyFromEmail`, per the app's password+email-derived keypair scheme). Stripping `email` from these responses would break encryption for any conversation with a user you haven't already messaged/cached. This exposure is a functional requirement of the current E2EE design, not an oversight — closing with no change.

If tighter access is ever wanted (e.g. only show email to accepted friends), it would need to come with a parallel change to how public keys are discovered for non-friends — flag that as a design conversation, not a quick patch.
