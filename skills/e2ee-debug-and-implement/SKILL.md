---
name: e2ee-debug-and-implement
description: Use when implementing, fixing, reviewing, or porting end-to-end encrypted messaging in web apps, especially when debugging NaCl-style public-key chat, session restore bugs, missing public keys, sender-history decryption failures, or frontend/backend contract mismatches.
---

# E2EE Debug And Implement

Use this skill for app-level E2EE work in chat systems where:

- keys are derived or provisioned on the client
- ciphertext is stored or transported by the server
- the backend should know public keys but not private keys
- users report refresh-time failures, missing recipient keys, or history decryption mismatches

## Workflow

1. Identify the crypto contract.
2. Verify where the current user's private key comes from.
3. Verify where other users' public keys come from.
4. Verify encryption inputs and decryption inputs for each message direction.
5. Verify refresh and logout behavior.
6. Verify backend payloads and cache invalidation.
7. Add or update tests for send, receive, and refresh cases.

## Non-Negotiable Checks

### 1. Current user key availability

Confirm all of the following:

- login derives or loads the current user's keypair
- app boot restores the current user's keypair if the session is still valid
- logout clears key material

If the token survives refresh but the keypair does not, expect:

- encryption keypair not initialized
- decryption keypair not initialized

## 2. Other users' public keys

Never guess another user's public key from partial identity data unless the protocol explicitly guarantees that derivation.

Prefer:

- user record stores `publicKey`
- login or registration publishes `publicKey`
- friends/contact/user lookup APIs return `publicKey`

If recipient public keys are missing, expect:

- recipient public key not found
- send works only for some users
- preload logs that are technically true but operationally misleading

## 3. Direction-aware decryption

For 1-to-1 chat history:

- received message peer key is usually `fromUserId`
- sent message peer key is usually `toUserId`

If history decryption always uses `fromUserId`, expect:

- incoming messages decrypt
- sent messages fail after reload
- NaCl reports wrong sender or invalid key

## 4. Session persistence

If app behavior requires refresh continuity, store session crypto material in an explicitly documented session mechanism and clear it on logout.

Document the tradeoff:

- `sessionStorage` is convenient
- it is still exposed to page JavaScript
- XSS defense becomes part of E2EE defense

## 5. Backend payload contract

Check:

- auth endpoints accept and return `publicKey` where needed
- friend/contact endpoints populate `publicKey`
- user model includes `publicKey`
- validators allow `publicKey`

If a backend response shape changes, also check caches:

- Redis keys
- server in-memory cache
- client cache

When needed, bump cache versions to avoid stale payloads.

## Implementation Pattern

### Frontend

- derive keypair from stable client-controlled secret material
- store own keypair in memory
- optionally persist current-session keypair in session-scoped storage
- preload friends' public keys
- fail fast with a user-facing error if recipient public key is missing
- decrypt history with a peer-id function based on direction

### Backend

- store only public key
- never store secret key
- return public key in contact/friend payloads
- invalidate or version caches when payload shape changes

## Diagnostics To Add

Add logs for:

- current auth user id
- has current keypair
- list or count of cached public keys
- selected recipient id during send
- peer id chosen during history decryption

Good diagnostic questions:

- Does refresh preserve auth but lose private key?
- Does the selected user actually have a public key in the payload?
- Is sender-history decryption using the wrong peer id?
- Is a stale cache hiding the new `publicKey` field?

## Minimum Test Set

- deterministic keypair derivation
- sender encrypts and recipient decrypts
- current user keypair restores from session
- logout clears persisted key material
- refresh can still decrypt own sent history
- missing recipient public key returns a clear UX error

## Failure Map

### Error: keypair not initialized

Likely causes:

- keypair only stored in memory
- refresh removed crypto state
- login did not finish key setup

### Error: recipient public key not found

Likely causes:

- backend did not return `publicKey`
- user never published `publicKey`
- stale cache serving old friend payload

### Error: invalid key, corrupted message, or wrong sender

Likely causes:

- wrong peer key selected for decrypt
- sent-history message using `fromUserId` instead of `toUserId`
- sender or recipient key mismatch across old/new protocol versions

## Reuse Rule

When porting this to another project, copy the whole system:

- key publication
- key restore
- direction-aware decrypt
- logout cleanup
- cache handling
- tests

Do not copy only the crypto primitive wrapper.
