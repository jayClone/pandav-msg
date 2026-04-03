# End-to-End Encryption Documentation

## Purpose

This document explains the private-chat E2EE design used in this project, the bugs that were diagnosed, the fixes that were applied, and the rules to follow when reusing or extending the implementation.

This E2EE layer currently covers 1-to-1 private chat messages stored and transported by the app.

## Stack

- Frontend crypto: `tweetnacl`
- Encoding helpers: `tweetnacl-util`
- Deterministic key derivation: `scrypt-js`
- Transport: Socket.IO private messages
- Persistence:
  - Message ciphertext stored in MongoDB
  - User public key stored in MongoDB
  - Current-session private key stored only in browser `sessionStorage`

## Current Model

### Key material

- Each user derives a deterministic NaCl box keypair from:
  - `email`
  - `password`
- The frontend derives:
  - `publicKey`
  - `secretKey`
- The backend stores only:
  - `publicKey`
- The backend never stores:
  - `secretKey`
  - raw password

### Message encryption

- Sender encrypts plaintext with:
  - recipient public key
  - sender secret key
- Recipient decrypts ciphertext with:
  - sender public key
  - recipient secret key

This is standard NaCl `box` authenticated public-key encryption.

## Files Involved

### Frontend

- [crypto.service.js](/e:/WORK/project%20pandav/pandav-msg/frontend/src/services/crypto.service.js)
- [login-form.jsx](/e:/WORK/project%20pandav/pandav-msg/frontend/src/components/login-form.jsx)
- [signup-form.jsx](/e:/WORK/project%20pandav/pandav-msg/frontend/src/components/signup-form.jsx)
- [auth.service.js](/e:/WORK/project%20pandav/pandav-msg/frontend/src/services/auth.service.js)
- [Layoute.jsx](/e:/WORK/project%20pandav/pandav-msg/frontend/src/pages/Layoute.jsx)
- [Chat.jsx](/e:/WORK/project%20pandav/pandav-msg/frontend/src/pages/Chat.jsx)
- [crypto.service.test.js](/e:/WORK/project%20pandav/pandav-msg/frontend/src/services/__tests__/crypto.service.test.js)

### Backend

- [User.js](/e:/WORK/project%20pandav/pandav-msg/backend/src/models/User.js)
- [auth.Controller.js](/e:/WORK/project%20pandav/pandav-msg/backend/src/controllers/auth.Controller.js)
- [friend.controller.js](/e:/WORK/project%20pandav/pandav-msg/backend/src/controllers/friend.controller.js)
- [auth.validator.js](/e:/WORK/project%20pandav/pandav-msg/backend/src/validators/auth.validator.js)

## Implemented Flow

### Registration

1. User enters `email` and `password`.
2. Frontend derives deterministic keypair from `email + password`.
3. Frontend sends `publicKey` with registration payload.
4. Backend stores `publicKey` on the `User` document.

### Login

1. Frontend derives keypair from `email + password`.
2. Frontend sends derived `publicKey` with login payload.
3. Backend updates the stored `publicKey` if needed.
4. Frontend stores:
   - `myKeypair` in memory
   - serialized keypair in browser `sessionStorage`

### Session restore

1. User refreshes the page.
2. JWT still exists, but in-memory crypto state is gone.
3. App restores keypair from `sessionStorage`.
4. Chat can decrypt history and send new messages again without forcing relogin.

### Friend key loading

1. Backend `/friends` returns each friend with `publicKey`.
2. Frontend caches those public keys in `cryptoService.publicKeys`.
3. Encryption uses the selected friend's cached public key.

### History decryption

For each encrypted message:

- If message was received:
  - decrypt using `fromUserId` public key
- If message was sent by current user:
  - decrypt using `toUserId` public key

This distinction is critical. Sent-message history cannot be decrypted using the current user's own public key as the peer key.

## Problems Diagnosed

### 1. Keypair not initialized after refresh

Symptom:

- Send failed with `Encryption keypair not initialized`
- Decrypt failed with `Decryption keypair not initialized`

Cause:

- `myKeypair` existed only in frontend memory after login.
- On refresh, the auth token survived but the crypto state did not.

Fix:

- Persist current-session keypair in `sessionStorage`
- Restore it on layout boot and chat access
- Clear it on logout

### 2. Public key derivation from email was incorrect

Symptom:

- Decryption or encryption failed even when keys appeared to exist

Cause:

- The app attempted to derive another user's public key from email alone.
- Actual user keypair was derived from `email + password`.
- Those values can never produce the same keypair.

Fix:

- Stop guessing other users' keys
- Publish and store the real public key per user
- Load that stored public key through friends API

### 3. Friend payloads did not include public key

Symptom:

- Logs claimed keys were preloaded
- Encryption failed with `Recipient public key not found for user`

Cause:

- Backend `getFriends` populate fields still excluded `publicKey`
- Redis could also serve stale friend payloads

Fix:

- Include `publicKey` in friend populates
- Version cache keys to bypass stale Redis data

### 4. Sent history messages failed after refresh

Symptom:

- Received messages decrypted
- Sent messages in history failed with:
  - `invalid key, corrupted message, or wrong sender`

Cause:

- History decryption always used `fromUserId` as the peer key
- For messages sent by the current user, the correct peer is `toUserId`

Fix:

- Introduce peer-key selection per message direction

## Security Notes

### Good properties

- Backend does not store private keys
- Backend does not need plaintext to route messages
- Ciphertext is authenticated, not just encrypted
- Public keys are explicit and stable

### Current tradeoff

The current frontend stores the user's secret key in `sessionStorage` for session continuity.

This is better than storing it permanently in `localStorage`, but it is still accessible to JavaScript running in the page. That means XSS remains a serious risk.

### Recommended hardening

- Enforce strong CSP
- Audit for XSS sinks
- Avoid dangerous HTML rendering
- Rotate keys if password changes
- Consider WebCrypto-backed wrapping for stored session material
- Consider user-approved device keys instead of deterministic password-derived keys

## Operational Notes

### Existing users

Users created before this E2EE fix may not have `publicKey` stored on their user record yet.

They must log in once after deployment so the frontend can publish the correct `publicKey` to the backend.

### Cache invalidation

Friend responses may be cached in Redis. Cache versioning was used to bypass stale payloads after the friend schema changed.

If more E2EE-related fields are added later, bump cache keys again or explicitly invalidate the old keys.

## Verification Checklist

- User can register and publish `publicKey`
- User can log in and derive/store own keypair
- User can refresh without losing decrypt/send capability
- Friend list includes `publicKey`
- Sender can encrypt to recipient
- Recipient can decrypt incoming message
- Sender can reload page and decrypt their own sent history
- Infinite scroll decrypts old encrypted messages
- Logout clears in-memory and session-stored key material

## Known Limitations

- Deterministic password-derived identity keys are simple but not ideal for modern multi-device E2EE
- Password change behavior is not yet modeled as a key migration event
- Group E2EE is not implemented by this document
- Session-stored private key still depends on frontend XSS hygiene

## Suggested Next Improvements

- Add key rotation on password change
- Add explicit key version to message payloads
- Add per-device keys instead of password-derived identity keys
- Add backend endpoint for direct public key fetch by user id
- Add integration tests for:
  - login -> send -> refresh -> decrypt history
  - sender history decryption
  - missing public key UX

## Reuse Guide

If you port this design to another project, do not copy only the crypto functions. Copy the full contract:

- public key publication
- session restore behavior
- message direction aware decryption
- logout cleanup
- tests for send, receive, and refresh

If any one of those pieces is missing, E2EE will look like it works in happy-path demos but fail in real usage.

## E2EE Skill

The reusable skill lives here:

- [SKILL.md](/e:/WORK/project%20pandav/pandav-msg/skills/e2ee-debug-and-implement/SKILL.md)

Use that skill as the portable version of the lessons from this implementation.
