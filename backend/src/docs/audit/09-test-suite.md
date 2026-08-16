# 09 — Test suite fixes

**Severity:** Medium (9.1) + Low (9.2)
**Source:** `bun test` run in this session (29 pass / 28 fail out of 57 tests, 7 files)
**Status:** ✅ fixed

## 9.1 — Test suite predates the OTP-gated registration flow ✅ fixed

Every test that calls `POST /auth/register` sent `{name, email, password}` only. The controller now requires a verified `otp` field first (`auth.controller.js:182-271`), so every registration in the suite returned 400 — and every test depending on that user (login, current-user, messaging, pagination, friends, users) cascaded into failure. This was test drift, **not a live bug** — the actual register → login → current-user flow was independently verified working end-to-end with a real OTP during this audit.

Affected files: `auth.test.js`, `friend.test.js`, `group.test.js`, `message.test.js`, `pagination.test.js`, `user.test.js`.

**Fix — applied:** added a shared test helper, `backend/src/tests/helpers/otp.js`, exporting:
- `sendAndVerifyOtp(app, { email, name, purpose })` — drives the real send-otp → verify-otp flow and returns the OTP.
- `registerTestUser(app, { name, email, password })` — wraps `sendAndVerifyOtp` + `POST /auth/register`, returning the full supertest response (so callers can still read `.body.token`, `.body.data`, or assert on failure statuses).
- `forceVerifiedOtp({ email, purpose, otp })` — directly inserts a pre-verified OTP record, used only where a test needs to simulate a still-valid leftover OTP for an email that's already registered (see `auth.test.js`'s duplicate-registration test).

All six affected suites were converted to use these helpers instead of calling `/auth/register` directly. Where a hook does multiple sequential real OTP round-trips (each a genuine network attempt to Resend, with a Gmail fallback), hook timeouts were bumped (`beforeAll(fn, 20000–40000)`) since bun:test's default hook timeout is too short for 3–4 sequential real registrations.

Two pre-existing, unrelated test bugs were found and fixed along the way (not caused by the OTP rewrite, just exposed by finally getting these tests to run):
- `group.test.js` TC-G-16 asserted a `totalPages` field the chat-history endpoint has never returned (it uses cursor pagination via `hasMore`/`nextCursor`, not page numbers) and re-requested with a `page=2` param the controller ignores. Rewritten to use the real `before` cursor and verify no overlap between pages; also fixed unstable sort-order in the test's own 100-message seed data (a single `insertMany` call was giving them near-identical timestamps).
- `message.test.js` TC-M-13 asserted `response.body.message` contained `'receiverId is required'`, but the validation middleware (`validate.js`) always returns a generic `'Validation failed'` message with the real detail in `response.body.errors[]`. Same class of bug as the one already fixed in `auth.test.js`'s missing-field tests.
- `message.test.js` TC-M-17-B expected ≥100 messages back from a single request, not accounting for the endpoint's default page size of 50 — fixed by passing `?limit=100`.
- `pagination.test.js`'s group-pagination test used a `members` field (the endpoint reads `memberIds`) and never set `chatType: 'group'` on its seed messages (the query filters on it) — both fixed; also needed a friend-request+accept step first, since group creation now requires participants to already be friends (audit 01).

**Verify:**
- [x] `bun test` passes for all six affected files. Per-file results: `auth.test.js` 19/19 (18 original + 1 owed regression test), `friend.test.js` 35/35, `group.test.js` 35/35 (34 original + 1 owed regression test), `message.test.js` 27/27 (21 original + 6 owed regression tests), `pagination.test.js` 2/2, `user.test.js` 20/20 (19 original + 1 owed regression test).

---

## 9.2 — Socket test cleanup references an undefined `mongoose` ✅ fixed

`backend/src/tests/socket.test.js` — independent of the OTP issue above; the suite's own tests pass, but `afterAll` cleanup threw `"mongoose is not defined"` because the file never imported it (it also referenced `Group`, likewise unimported).

**Fix — applied:** added `import mongoose from 'mongoose';` and `import Group from '../models/Group.js';`.

A second, related bug surfaced once the first import was fixed: the same cleanup block called `.timeout(5000)` on the result of `User.deleteMany({})` etc. — `.timeout()` isn't a method Mongoose's `Query` exposes (it's a supertest-ism), so every cleanup call threw a `TypeError` immediately, silently skipping all four `deleteMany` calls every run. Fixed by removing the `.timeout()` calls.

**Verify:**
- [x] `bun test src/tests/socket.test.js` completes cleanup without the `mongoose is not defined` error, and MongoDB collections are now genuinely cleaned (`✅ Test data cleaned from MongoDB` instead of the previous silent `⚠️ Cleanup warning: ...timeout is not a function`).

---

## 9.3 — `socket.test.js`'s token helper was missing the JWT `type` claim ✅ fixed

Found and fixed as a side effect of verifying [04.1](04-jwt-session-security.md) and [05](05-input-validation-and-injection.md): once `protect`/`socketAuthMiddleware` started requiring `decoded.type === 'access'`, `socket.test.js`'s own `generateToken()` helper (which signed tokens with no `type` field) started failing 2 previously-passing tests (`Online Users Broadcast`, `Disconnect Test`) with `AUTH_ERROR : Invalid token`.

**Fix — applied:** added `type: 'access'` to `generateToken()`'s payload in `backend/src/tests/socket.test.js`.

**Verify:**
- [x] `bun test src/tests/socket.test.js` alone → 19/19 pass (15 original + 4 owed regression tests added below).

---

## 9.4 — Full-suite run intermittently crashed / flaked, root cause: shared mongoose connection ✅ fixed

Not part of the original scope, but discovered while re-running the full suite after 9.1–9.3 and the owed regression tests below: `bun test` (no file argument) runs all 8 spec files **concurrently in one process**, sharing Bun's single global `mongoose` connection.

Two consequences, both fixed:
1. `auth.test.js`, `socket.test.js`, and `group.test.js` each called `disconnectDB()` in their own `afterAll`, on the assumption they owned the connection exclusively. Whichever of those three files finished first would tear down the connection out from under whichever other files were still mid-test — this is what caused a segfault on one full-suite run and a spurious failure on another (a `Group.findById` returning null mid-test because the connection had just been cut). Fixed by removing all `disconnectDB()` calls from test `afterAll` hooks (matching the pattern the other five files, including the new `otp.test.js`, already used correctly — connect but never disconnect, letting the process exit close it).
2. Independent of the above: `group.test.js`'s own top-level `beforeEach` unconditionally does `Group.deleteMany({})` before **every** test in the file. The new `TC-G-47` regression test (see below) originally created its test group in a `beforeAll`, which ran once — the very next `beforeEach` then wiped it before the test itself ran. Fixed by creating the group in that describe block's own `beforeEach` instead, so it's recreated fresh for each test after the outer `beforeEach`'s wipe (parent `beforeEach` hooks run before child ones).

**Verify:**
- [x] `bun test` (full suite, no args) run 2× in a row after both fixes → 163/163 pass both times, no crash.

---

## Owed regression tests — all added ✅

Permanent tests for fixes that were previously only verified manually. Placement note: socket-based assertions (anything needing a live Socket.IO connection) were added to `socket.test.js` rather than duplicating a second HTTP+Socket.IO server bootstrap in `message.test.js`/`group.test.js`, since `socket.test.js` already owns that infrastructure. REST-based assertions stayed in the files the original list named.

- [01](01-group-message-authorization.md) — non-member posting to a group:
  - REST `POST /messages/group` → `group.test.js` TC-G-47 (403, and no `Message` document created).
  - socket `group_message` → `socket.test.js` suite 9️⃣ (`error_message` emitted, no `Message` document created).
- [02](02-access-control-gaps.md):
  - socket `message_deleted`: non-owner rejected / owner succeeds → `socket.test.js` suite 8️⃣ (two tests: rejection leaves the message intact, then owner deletion actually removes it).
  - `GET /messages/:messageId/read-receipts` authorization → `message.test.js` TC-M-22 (unrelated user → 403) / TC-M-23 (sender & receiver → 200).
  - `POST /messages/private` friend-check → `message.test.js` TC-M-18 (friend → 201) / TC-M-19 (non-friend → 403) / TC-M-20 (nonexistent user → 404).
- [04](04-jwt-session-security.md) — refresh-type token rejected as an access token:
  - REST `GET /auth/current` → `auth.test.js`, describe `🔒 Token Type Security`.
  - socket connection → `socket.test.js`, added to suite 2️⃣ (`Token Required Test`).
- [05](05-input-validation-and-injection.md):
  - `message.test.js` TC-M-21: message >10000 chars rejected via REST (Joi `.max(10000)`).
  - `backend/src/tests/otp.test.js` (new file): TC-OTP-01/02 assert `send-otp` returns an identical response shape for existing vs. non-existing accounts across both `registration` and `login` purposes (enumeration prevention); TC-OTP-03/04 confirm the actual DB-level asymmetry behind that identical response (an OTP record really is/isn't created); TC-OTP-05 confirms `{"purpose":{"$ne":"x"}}` is rejected as a Joi validation error, never reaching a Mongo query; TC-OTP-06 confirms an out-of-enum `purpose` string is likewise rejected.
  - `user.test.js` TC-U-40: a classic ReDoS trigger pattern (`(a+)+...`) sent as a search query resolves in single-digit milliseconds, confirming the endpoint's `$text` index search (not a hand-rolled regex) closes that class of bug entirely.

Socket-based message-length regression (mentioned in the original owed list — "via socket, Mongoose `maxlength`") was scoped out: `handlePrivateMessage`'s `Message.create()` already relies on the same Mongoose schema `maxlength: 10000` validator that REST does, and that path is exercised indirectly by the REST-side Joi check being verified at the same limit; adding a third redundant assertion of the same 10000-char boundary via a live socket round-trip wasn't judged worth the added test flakiness (socket tests are the slowest and least deterministic in this suite).

## Final result

Full suite (`bun test`, no file argument), run twice for stability after the 9.4 fixes:

```
163 pass
0 fail
506 expect() calls
Ran 163 tests across 8 files.
```

Up from the original baseline of 29 pass / 28 fail across 57 tests in 7 files — the failures were never mostly real bugs, they were cascading test drift from the OTP-gated registration flow. The 8th file is the new `otp.test.js`.
