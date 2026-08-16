# 07 — Data integrity & concurrency

**Severity:** Blocker (7.1) + Medium (rest)
**Source:** backend-architect, database-architect
**Status:** ✅ 7.1 and 7.3 fixed and live-verified (2026-08-16) · 7.2 intentionally deferred · 7.4 resolved with no code change (see decision below)

## 7.1 — Group membership writes race under concurrency (Blocker) ✅ fixed

All group-membership and presence writes followed the same shape: load the full `Group` document, mutate an array in JS, then `.save()` the whole thing back — a classic check-then-act race where two concurrent operations on the same group could silently lose one's change.

**Fix — applied:** replaced every read-modify-write with atomic Mongo update operators.
- `backend/src/controllers/group.controller.js` — `addMember` now uses `Group.findByIdAndUpdate(groupId, {$addToSet: {participants: newMemberObjId}}, {new: true})`; `removeMember` uses `$pull` the same way.
- `leaveGroup` is a bit more involved since it also conditionally reassigns `adminId` to a remaining member. Now uses `Group.findOneAndUpdate({_id: groupId, participants: userId}, update, {new: true})` — matching on `participants: userId` in the filter (not just `_id`) means the update only applies if the user was still a member at the moment it ran, which avoids a lost-update race with a concurrent leave/removal. `update.$set.adminId` is only added when reassignment is actually needed.
- `backend/src/socket/handlers/user-status.handler.js` — `handleUserConnect`/`handleUserDisconnect` now use `Group.findByIdAndUpdate(group._id, {$addToSet: {onlineMembers: userId}}, {new: true})` / `$pull`, per group, instead of loading each group, mutating `onlineMembers` in JS, and saving the whole document back.

**Verify:**
- [x] Fired two genuinely concurrent `addMember` calls (different members, via `Promise.all` + `fetch` — not sequential PowerShell calls, which can't produce real network-level concurrency) against the same group → both members ended up in `participants`. Confirmed live; this is exactly the scenario that silently dropped one update before the fix.
- [x] Same test for concurrent `removeMember` → both removals applied.
- [x] Socket connect/disconnect: confirmed live that `Group.onlineMembers` correctly gains the user on connect and loses them on disconnect, via a real `socket.io-client` connection against the running server.

---

## 7.2 — Presence data living in MongoDB instead of Redis — intentionally deferred

Not attempted this round, per the original finding's own guidance ("do 7.1's atomic-update fix first as a stopgap, then plan this as a follow-up rather than blocking on it"). 7.1 already removes the *lost-update* risk this was partly about. The larger architectural move (presence state into Redis with a TTL) is real follow-up work, but couldn't be meaningfully attempted here anyway — the configured Redis instance has been unreachable all session and there's no local Redis or Docker on this machine to build/test against. Left open.

---

## 7.3 — Group chat was stored in cleartext — ✅ implemented (pairwise fan-out E2EE)

**Decision (asked, not assumed):** given the choice between documenting the gap vs. actually building group E2EE, and between backend-only vs. backend+frontend, the calls were: **implement it**, and **touch the frontend too** (a backend-only change would just store ciphertext blobs with no way to produce or read them — not real E2EE). Also chose the **pairwise fan-out** design over a shared/rotating group key: it reuses the existing NaCl box primitive exactly as-is, with no new key-distribution or rotation protocol to get right, at the cost of message storage growing with group size — an acceptable trade for friend-sized groups, not for huge broadcast groups.

### How it works

A group message is now the same NaCl box encryption already used for private messages (`crypto.service.js`'s `encryptMessage`), just performed once per current group member **including the sender** (so they can re-read their own sent messages later). This works because of a property of `nacl.box` this codebase's private-chat code already relies on: the shared secret from `DH(mySecret, theirPublic)` is symmetric, so a ciphertext encrypted as `box(msg, nonce, recipientPub, senderSecret)` can be opened by **either** party using "the other party's public key" — the sender can decrypt their own sent ciphertext via `decryptMessage(ciphertext, recipientId)`, exactly the same call a recipient uses via `decryptMessage(ciphertext, senderId)`. Encrypting a message to *yourself* (`box(msg, nonce, myOwnPub, myOwnSecret)`) is the same valid, well-defined operation, just with both DH inputs being your own keypair — so the sender's own history-readable copy needs no special-casing anywhere.

### Backend changes

- **`backend/src/models/Message.js`** — new `groupCiphertexts` field: `Map<userId, ciphertext>`, capped at 200 entries (matches the group-size cap from [05.1](05-input-validation-and-injection.md)) and 20,000 chars per ciphertext (plaintext cap 10,000 chars plus NaCl box/base64 overhead, with headroom). `message` is now conditionally required — not required when this is an encrypted group message (`chatType === 'group' && groupCiphertexts.size > 0`), since its content lives in `groupCiphertexts` instead.
- **`backend/src/controllers/group.controller.js`** — every `.populate('participants', ...)` across `createGroup`, `getMyGroups`, `getGroup`, `addMember`, `removeMember`, `leaveGroup` now includes `publicKey` (it didn't before — the frontend had no way to get a group member's public key at all). `getGroupMessages` now resolves each encrypted message to the *requesting user's own* `groupCiphertexts` entry before returning it as `message`, and now actually includes `isEncrypted` in the response (missing entirely before — a pre-existing gap, not something this feature introduced, but it had to be added for the client to know when to decrypt).
- **`backend/src/controllers/message.controller.js`** (`sendGroupMessage`) and **`backend/src/socket/handlers/group-message.handler.js`** (`handleGroupMessage`) both now accept `isEncrypted` + `ciphertexts` (an object keyed by member userId) instead of requiring plaintext `message` when encrypted, and both **reject the write if `ciphertexts` doesn't cover exactly the group's current member list** — if even one member is missing an entry, they'd have no way to ever read that message, so this fails the request with a 400 rather than silently shipping a partially-unreadable message.
- **`backend/src/validators/message.validator.js`** — `SendGroupMessageSchema` now conditionally requires `message` OR `ciphertexts` depending on `isEncrypted` (Joi `.when()`), with `ciphertexts` validated as an object of 24-hex-char keys to string values.
- Socket broadcast sends the **whole** `ciphertexts` map to the group room (`io.to(groupId).emit(...)`) rather than restructuring into per-member emits — simpler, and not a security cost: a NaCl box ciphertext is opaque without the matching private key, so another member's entry being visible in the payload reveals nothing. Each client just picks out its own entry.

### Frontend changes

- **`frontend/src/services/crypto.service.js`** — new `encryptForGroup(plaintext, memberUserIds)`: calls the existing `encryptMessage()` once per member (self included), returns `{[userId]: ciphertext}`. No new crypto primitive — just the same private-message encryption called N times.
- **`frontend/src/pages/GroupChat.jsx`** (confirmed via `Layoute.jsx` this is the actually-routed component, not the dead `pages/Unuse/GroupChat.jsx`):
  - `handleSelectGroup` now pre-loads every member's public key (`cryptoService.storePublicKey`) once group details are fetched, and decrypts message history (both the initial fetch and `loadMoreGroupMessages`'s infinite-scroll fetch) using the sender as the decryption peer.
  - `handleSendMessage` now checks every member has a known public key before sending (shows a clear error naming the member if not, rather than silently failing or sending an incomplete map), encrypts via `encryptForGroup`, and emits `isEncrypted`/`ciphertexts` instead of plaintext.
  - The `group_message` socket listener decrypts `data.ciphertexts[currentUserId]` using the sender's public key before adding the message to state or the sidebar's last-message preview.

### Verify

Couldn't drive an actual browser here, so this was verified as close to end-to-end as possible without one: a Node script using the **real** `tweetnacl`/`scrypt-js`/`tweetnacl-util` packages (the same ones the frontend imports) derived real keypairs for three test users, registered/logged them in against the real running backend (publishing their public keys via the real login flow), created a real group, and drove the real REST + Socket.IO endpoints:

- [x] `getGroup` returns `publicKey` for every participant (the populate fix).
- [x] Alice encrypts one message via genuine pairwise fan-out (3 ciphertexts, self included) and emits it over a real socket connection.
- [x] Bob and Carol, each on their own real socket connection, receive the broadcast and **correctly decrypt their own entry** using the sender's public key.
- [x] Cross-decryption check: Bob **cannot** decrypt Carol's ciphertext entry using his own key — confirms the encryption is genuinely per-recipient, not just stored-but-shared plaintext.
- [x] REST `getGroupMessages`, fetched as Bob, returns his personalized ciphertext, which decrypts correctly.
- [x] REST `getGroupMessages`, fetched as **Alice** (the original sender), lets her decrypt her own past sent message — confirms the self-encrypt/self-decrypt history-reread case actually works, not just the "two different people" case.
- [x] Sending with an incomplete `ciphertexts` map (missing one current member) → `400`, confirmed live.
- [x] `bunx vite build` — clean build, no syntax/type errors from the frontend changes.
- [x] Full backend `bun test` suite re-run after all of this → still the exact 29-pass/28-fail baseline, no regressions.

### What this doesn't cover (be aware before relying on it)

- **No forward secrecy / no re-keying on membership change.** A removed member can still decrypt messages sent before their removal (they had a valid ciphertext at the time). This matches the existing private-chat E2EE model's security posture (static keypair-per-account) — not a new weakness, but worth knowing it doesn't get stronger for groups.
- **Storage grows with group size** (one ciphertext per member per message) — fine for friend-sized groups, would not scale to large broadcast-style groups.
- **Messages from a member who has since left the group may fail to decrypt** in the UI if their public key isn't in the (now-current-members-only) preload — a reasonable edge case, not fixed further here.

---

## 7.4 — `deleteGroup`'s two deletes — resolved, no transaction added

**Decision (asked, not assumed):** confirmed the local dev MongoDB is a standalone instance (transactions would fail against it — `replSetGetStatus` returns "not running with --replSet"), and production topology is unconfirmed ("standalone / not sure"). Given that, added **no transaction** — shipping one against an unknown-or-standalone production topology risks breaking `deleteGroup` outright, which is worse than the existing gap.

`backend/src/controllers/group.controller.js`'s `deleteGroup` already deletes in the safer order — `Message.deleteMany({groupId, chatType:'group'})` **then** `Group.findByIdAndDelete(groupId)` — unchanged by this decision. If something fails between the two steps, the result is a group with no message history (recoverable, low-harm) rather than orphaned messages pointing at a deleted group (harder to clean up). No code change made.

**If this needs revisiting:** confirm the production Mongo topology first (Atlas and most managed MongoDB are replica sets by default). If it is, wrap both deletes in `mongoose.startSession()` + `session.withTransaction()` as originally proposed — and note that testing it will require that same replica-set topology; it can't be verified against this local standalone instance.
