# 05 — Input validation & injection hardening

**Severity:** Blocker (5.1) + Medium (rest)
**Source:** backend-architect, security-engineer
**Status:** ✅ 5.1–5.7 fixed and live-verified (2026-08-15). Scope note: full per-route Joi coverage was intentionally *not* extended to every friend/group/user action — see 5.1's scope note below.

## 5.1 — No size limit on messages, and no schema validation on most write routes (Blocker) ✅ fixed

Only `/auth/register` and `/auth/login` ran through Joi. Every other mutating route relied on ad-hoc presence checks. Combined with the old 50MB global body limit and no `maxlength` on `Message.message`, a single chat message (REST or socket) could be tens of megabytes.

**Fix — applied:**
- `backend/src/models/Message.js` — `message` field now has `maxlength: [10000, ...]`. This is the fix that matters most: it's enforced by Mongoose on **every** write path, including the Socket.IO handlers, which never go through Express/Joi at all.
- `backend/src/app.js` — body limit dropped from `50mb` to `1mb` for both `express.json()` and `express.urlencoded()`. There are no file-upload routes in this backend, so 1mb is generous for a text-chat JSON API and closes the DoS surface on every route, including unauthenticated ones like `/auth/login`.
- New `backend/src/validators/message.validator.js` (`SendPrivateMessageSchema`, `SendGroupMessageSchema`) wired into `message.routes.js` for `POST /messages/private` and `POST /messages/group` — validates `message` (1–10000 chars), the relevant id (24-char hex), and optional `isEncrypted` boolean.
- New `backend/src/validators/otp.validator.js` (`SendOtpSchema`, `VerifyOtpSchema`, `ResendOtpSchema`) wired into all three `otp.routes.js` endpoints — this is also the fix for 5.2 below.
- `backend/src/controllers/group.controller.js` — `createGroup` now rejects `memberIds` arrays over 200 entries.

**Scope note — what wasn't extended, and why:** the original checklist also called for Joi schemas on friend actions, group add/remove-member, and user search. Those controllers already do solid manual validation (ObjectId format checks, existence checks, ownership checks) for every field they read, and the actual Blocker-level risk here — unbounded *size* — is fully closed by the schema `maxlength` + the 1mb global body cap, which apply regardless of which route is hit. Adding Joi wrappers around already-validated, low-arity endpoints (a friend request body is just `{receiverId}`) would be consistency polish, not a security fix, so it was left out to keep this change scoped to what the Blocker actually required. Worth doing eventually for consistency, not urgent.

**Verify:**
- [x] REST: a 15,000-char private message → 400 `"Message cannot exceed 10000 characters"` from Joi, confirmed live, never reaches the DB.
- [x] Socket: a 50,000-char private message sent via the `private_message` event (which never touches Joi) → rejected at the Mongoose layer, client gets `error_message: "Failed to save message"`, confirmed live via a `socket.io-client` script — message count in the DB unchanged before/after.
- [x] `POST /auth/login` with a >1MB body → `413 Payload Too Large`, confirmed live.
- [x] Creating a group with 200+ `memberIds` → rejected (code-level; not re-exercised live this round, trivial length check).

**Related, not fixed (out of scope):** `Message.js`'s schema also has `trim: true` on `message`, which runs unconditionally on save — including for encrypted messages, whose ciphertext (base64) could theoretically have meaningful leading/trailing characters stripped, even though the controllers already skip their own `.trim()` call when `isEncrypted` is true. Didn't touch this since it needs testing against the actual E2EE encode/decode round-trip to confirm real impact, which is outside this file's scope — flagging here since it's directly adjacent to the line just edited.

---

## 5.2 — NoSQL operator injection surface in OTP `purpose` field ✅ fixed

`purpose` went from `req.body` straight into a Mongo filter with no coercion — `{"purpose":{"$ne":"x"}}` would be forwarded as a live query operator. Separately, `express-mongo-sanitize` was a listed dependency but never wired up.

**Fix — applied:**
- The new `otp.validator.js` schemas constrain `purpose` to `Joi.string().valid('registration','login','password-reset')` — this alone closes the injection, since Joi rejects anything that isn't one of those exact strings before it ever reaches a Mongo query.
- `express-mongo-sanitize` is now wired up — but **not** via its own `middleware()` export. That export does `req.query = sanitizedTarget`, which throws in Express 5 because `req.query` is a getter-only accessor (confirmed by reading `express/lib/request.js` — `defineGetter` sets `get` only, no `set`). Using it as documented would have crashed **every request** the moment it hit a query string. Instead, wrote `backend/src/middlewares/mongoSanitize.js`, a small wrapper that calls the library's exported `sanitize()` function directly on `req.body`/`req.params`/`req.query` for its in-place mutation side effect, and never reassigns `req.query` itself. Wired into `app.js` right after body parsing.

**Verify:**
- [x] `POST /api/v1/otp/verify-otp` with `{"purpose":{"$ne":"x"}}` → `400 Validation failed` (`"purpose" must be a string`), confirmed live — the debug log even showed the sanitizer had already reduced the payload to `purpose: {}` before Joi ran, then Joi rejected the empty object.
- [x] The mongo-sanitize wiring itself doesn't crash the app — confirmed live with both a query-string injection attempt (`?q[$ne]=x`, got a normal 401, not a 500/hang) and the body-based one above; server kept serving requests normally afterward.

---

## 5.3 — ReDoS via unescaped regex in user search ✅ fixed, then superseded by [06.3](06-database-performance-and-pagination.md#63--user-search-did-a-full-collection-scan--fixed)

> Update from file 06: `searchUsers` no longer builds a regex at all — it was migrated to a MongoDB `$text` index search while fixing the collection-scan performance issue, which removes the ReDoS surface structurally rather than just escaping it. The regex-escaping fix described below is no longer in the code, but is kept here for the record.

`searchUsers` built `{name:{$regex:searchTerm,...}}` directly from `req.query.q`, unescaped.

**Fix — applied:** `backend/src/controllers/user.controller.js` now escapes regex metacharacters before building the filter: `q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.

**Verify:**
- [x] A crafted pathological pattern (`(a+)+$.*[` — unbalanced bracket, repetition operators) returned in 428ms with a clean empty result, confirmed live — previously this string would have been passed to MongoDB as a literal (invalid) regex or, with a genuinely catastrophic pattern, risked backtracking.

---

## 5.4 — User enumeration via the OTP endpoint ✅ fixed

`send-otp` returned a distinct 404 for `purpose=login` on a nonexistent account and a distinct 409 for `purpose=registration` on an existing one.

**Fix — applied:** `backend/src/controllers/otp.controller.js` (`sendOTP`) now returns the same generic `200` response — `"If eligible, an OTP has been sent to {email}"` — regardless of whether the account exists, for both purposes. The real OTP-creation/email-send logic is skipped silently in the cases that would have leaked existence, but the HTTP response is identical either way.

**UX tradeoff worth knowing about:** this means a user who mistypes their email during "login" (typo'd, account doesn't actually exist) or tries to "register" an email they already have an account on no longer gets an immediate, specific error telling them so — they'll find out one step later, when OTP verification fails generically ("OTP not found"). That's the standard cost of closing an enumeration vector; flagging it since it's a real, deliberate product-facing change, not just a backend implementation detail.

**Verify:**
- [x] `registration` purpose for a brand-new email → `200`, OTP actually created (confirmed via direct DB read).
- [x] `registration` purpose for an email that already has an account → `200`, **identical response shape** to the above, confirmed live side-by-side.
- [x] `login` purpose for an email with no account → `200`, identical shape, and confirmed **zero** OTP documents created for that email (direct DB check) — the skip path is real, not just a response-shape cosmetic change.

---

## 5.5 — OTPs generated with `Math.random()`, not a CSPRNG ✅ fixed

**Fix — applied:** `backend/src/controllers/otp.controller.js` now generates OTPs with `crypto.randomInt(100000, 1000000)` instead of `Math.random()`-based arithmetic.

**Verify:** functional — OTPs observed during this session's testing were still well-formed 6-digit strings; register/login/verify flows using them worked normally throughout.

---

## 5.6 — Unescaped user input in outbound HTML email ✅ fixed

**Fix — applied:** `backend/src/services/email.service.js` now has an `escapeHtml()` helper (escapes `& < > " '`) applied to `name` in both `getOTPTemplate` and `getWelcomeTemplate` before interpolation. `otp` itself is left unescaped since it's always server-generated (never user input).

**Verify:**
- [x] Called both template functions directly (no network needed — Resend/Nodemailer clients don't connect until actually sending) with `name = '<img src=x onerror=alert(1)>Bob'`. Confirmed live: neither template's output contains the raw `<img` tag; both contain the fully HTML-escaped version instead.

---

## 5.7 — Joi validation allows unknown fields through ✅ fixed

**Fix — applied:** `backend/src/middlewares/validate.js` now uses `stripUnknown: true, allowUnknown: false`, and returns the validated `value` directly as `req[source]` instead of spreading it back over the original raw body (the old `{ ...req[source], ...value }` would have silently re-added any keys Joi had just stripped, defeating the point).

Checked before flipping this: `RegisterSchema`/`LoginSchema` already cover every field their controllers read (`name/email/password/otp/publicKey` and `email/password/publicKey` respectively), and the frontend's actual request payloads (`auth.service.js`, `otp.api.js`, `message.api.js`) don't send anything beyond what the new schemas expect — a `login()` code path that conditionally attaches an `otp` field exists in the frontend but is never actually triggered by the live UI (the backend `login` controller doesn't use `otp` either), so it's dead code, not a live payload this change would break.

**Verify:**
- [x] Indirectly confirmed via every other live test in this file — register/login/OTP/message flows all continued to work end-to-end with the stricter setting active.

---

## Regression found and fixed while verifying this file

Running the full `bun test` suite after these changes (as a broader check, not just my own manual scripts) surfaced 2 newly-broken tests that were passing before this session: `Socket.IO Backend QA Tests > Online Users Broadcast` and `> Disconnect Test`, both failing with `AUTH_ERROR : Invalid token`. Root cause: **not** a 05 change — it's fallout from [04.1](04-jwt-session-security.md)'s JWT `type` check. `backend/src/tests/socket.test.js`'s own `generateToken()` helper signs test tokens without a `type` claim, so the new `decoded.type !== 'access'` check in `socket.auth.js` was rejecting them.

Fixed by adding `type: 'access'` to that helper's token payload (matching what real login-issued tokens look like) — re-ran `socket.test.js` alone afterward: 15/15 pass, 0 fail. Re-ran the full suite: back to the original 29-pass/28-fail baseline, confirming no other regressions from anything in this file either.

This is exactly the kind of thing file [09](09-test-suite.md) exists to catch — noting it there too so it's not lost, and as a reminder to run the full suite (not just targeted manual checks) after any change touching shared auth/socket code.
