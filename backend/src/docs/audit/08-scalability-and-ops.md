# 08 — Scalability & ops hardening

**Severity:** High (8.1, 8.2) + Medium/Low (rest)
**Source:** backend-architect, security-engineer
**Status:** ✅ 8.1, 8.3–8.8 fixed and live-verified where the platform allows it (2026-08-16). 8.2's code is correct but couldn't be proven end-to-end on this Windows dev machine — see below, this is a testing-environment limitation, not an unresolved item.

## 8.1 — No Socket.IO adapter — presence and rooms break past one instance ✅ fixed

**Fix — applied:** installed `@socket.io/redis-adapter`. `backend/src/socket/socket.server.js`'s `createSocketServer` is now `async`; it calls `getRedis()` (the same client `config/redis.js` already manages) and, if connected, duplicates it for a dedicated subscriber connection and calls `io.adapter(createAdapter(pubClient, subClient))`. If Redis isn't available, it logs a warning and falls back to Socket.IO's default in-memory adapter — matching this app's existing fail-open Redis pattern everywhere else. `backend/src/server.js` now does `const io = await createSocketServer(httpServer)`.

**Verify:**
- [x] Server starts cleanly with the new async adapter-setup code and correctly logs `"Redis not available — Socket.IO using in-memory adapter (single-instance only)"` when Redis is unreachable — confirmed live (the configured Redis instance has been unreachable all session, so this is exactly the fallback path that actually runs here).
- [ ] **Not verified: real cross-instance delivery.** Proving the adapter itself works (two server instances behind a shared Redis, message sent by a user on instance A reaching a recipient on instance B) needs a reachable Redis, which this environment doesn't have. The wiring is correct per the library's documented usage (confirmed by reading its README/examples) and the fallback path is proven not to crash, but the actual multi-instance pub/sub behavior is unverified here — re-check this once a real Redis is available, ideally before the first actual multi-instance deploy.

---

## 8.2 — No graceful shutdown — code is correct, but couldn't be end-to-end verified on Windows

**Fix — applied:** `backend/src/server.js` now has `process.on('SIGTERM', ...)` / `process.on('SIGINT', ...)` handlers that stop accepting new connections (`httpServer.close()`), close all Socket.IO connections (`io.close()`), close the MongoDB connection, and exit — with a 10-second force-exit timer in case something hangs (e.g. a stuck keep-alive connection never lets `httpServer.close()`'s callback fire).

**What happened trying to verify this:** sent `SIGTERM` to the running process via `process.kill(pid, 'SIGTERM')` (both from a separate Node process and from a separate Bun process, to rule out a cross-runtime issue) — the process died immediately with exit code 1 and **none** of the shutdown log lines printed. To isolate whether this was a bug in the actual shutdown code, ran the identical test against a 5-line throwaway script containing nothing but `process.on('SIGTERM', () => { console.log('caught'); process.exit(0); })` — **same result**, signal not caught.

That isolation test is the important part: it proves this is a Windows platform limitation, not a defect in `server.js`. Per Node.js's own documentation, `process.kill()` on Windows for `SIGTERM`/`SIGINT` doesn't deliver a catchable signal to another process the way POSIX `kill -TERM` does — it unconditionally terminates the target process (`TerminateProcess()`), and the only way to trigger a *catchable* `SIGINT` on Windows is an actual Ctrl+C keypress in an attached interactive console, which isn't something this tooling can send to a backgrounded process. This app deploys to Render (Linux containers — see the `trust proxy`/"RENDER PASSES REAL IP HERE" comment in `app.js`), where real POSIX `SIGTERM` delivery applies and this exact, standard pattern is known to work correctly.

**Verify:**
- [x] Code reviewed against the standard Node.js graceful-shutdown pattern (stop accepting → drain → close dependencies → exit, with a force-exit timeout) — matches established practice.
- [ ] **Not verified end-to-end** — needs a POSIX environment (the actual Linux deploy target, WSL, or Docker) to send a real, catchable `SIGTERM` and confirm the shutdown log sequence appears before exit. Recommend a quick one-time check there before depending on this for zero-downtime deploys.

---

## 8.3 — Error messages leaking internals to clients ✅ fixed

**Fix — applied:** new `backend/src/utils/errorResponse.js` exports `sendServerError(res, error, fallbackMessage)`, gating the message (and stack, in dev) by `NODE_ENV` exactly like the global handler in `app.js` already does. Replaced all 30 occurrences of the leaking pattern (`message: error.message` / `error: error.message` in a 500 response) across `auth.Controller.js`, `otp.controller.js` (all three handlers), `user.controller.js`, `message.controller.js`, `group.controller.js`, and `friend.controller.js` with calls to this helper, each keeping its existing specific fallback message (e.g. `"Failed to fetch friends"`).

**Verify:**
- [x] Confirmed the gating logic directly: called `sendServerError` with a fake response object and a realistic internal error object under both `NODE_ENV=production` (fallback message only, no stack) and `NODE_ENV=development` (full internal message + stack) — both behaved correctly.
- [x] Every call site was replaced via direct edits (not a scripted find/replace), so each was individually confirmed to preserve its original fallback message and logging call.

---

## 8.4 — Two different CORS allow-lists, only one enforced ✅ fixed

**Fix — applied:** new `backend/src/config/cors.js` exports a single `allowedOrigins` array (env-driven — includes `CLIENT_URL`/`FRONTEND_URL` when set, plus the known static origins), imported by both `app.js`'s Express `cors()` config and `socket.server.js`'s Socket.IO CORS config. The old `app.js` had built one array just for a `console.log` and enforced a second, different hardcoded one — that dead array is gone; `socket.server.js`'s separate `getOrigin()` function (which also only included `CLIENT_URL` in production mode) is gone too.

**Verify:**
- [x] Confirmed live: a request with `Origin: http://localhost:5173` (in the shared list) → `200` with the matching `Access-Control-Allow-Origin` header.
- [x] Confirmed live: a request with a disallowed origin → rejected (surfaces as a 500 via the existing `callback(new Error(...))` → global-handler path, a pre-existing minor rough edge — arguably should be a clean 403, but that's the CORS middleware's error-shape, unrelated to and out of scope for this specific list-consolidation fix).
- [x] The started server log now prints the single consolidated origin list once, matching what's actually enforced — no more silent mismatch between what's logged and what's checked.

---

## 8.5 — Health check now reflects real dependency state ✅ fixed

**Fix — applied:** `backend/src/controllers/health.controller.js` now exports `getHealthStatus()` (checks `mongoose.connection.readyState` and calls the existing `checkRedisHealth()` helper, which was already written but never wired into a route) and `healthCheck` (used by `GET /api/v1/health`, returns `503` if Mongo is down). `app.js`'s separate top-level `GET /health` route now uses the same `getHealthStatus()` instead of a static 200, so both health endpoints agree. Redis status is reported but doesn't affect the verdict — matches the app's existing design where every Redis-dependent path already fails open.

**Verify:**
- [x] Confirmed live: both `/health` and `/api/v1/health` return `200` with `mongo:"connected", redis:"disabled"` while everything is actually healthy (Redis is genuinely unreachable here, and it correctly does **not** flip the overall status to unhealthy).
- [ ] **Not re-verified live:** the actual `503`-on-Mongo-down path. Deliberately did not stop the local MongoDB service to test this — it's a shared resource this whole audit session depends on for every other test, and stopping/restarting it for one check wasn't worth the risk of disrupting other in-progress state. The check itself (`mongoose.connection.readyState === 1`) is standard, well-documented Mongoose API, not something exotic — low risk, but flagging it as unverified rather than claiming otherwise.

**Heads up for deployment:** if Render (or wherever this runs) uses `/health` for liveness/readiness checks and auto-restarts on non-200, a real Mongo outage will now correctly show as unhealthy — which is the point, but means a Mongo blip could now trigger a restart cycle where it previously wouldn't have (the endpoint used to always say 200 no matter what). Worth confirming that's the intended behavior with whoever owns the deploy config.

---

## 8.6 — Extensionless imports ✅ fixed

**Fix — applied:** added the missing `.js` extensions in `group.controller.js` (`Group`, `User`, `Friend` imports) and `private-message.handler.js` (`Friend` import) — the two files named in the original finding. Also swept the rest of `backend/src` for the same pattern and found no others.

**Verify:**
- [x] Server starts cleanly with the corrected imports (a broken import would fail at module-load time, before the server could start at all — confirmed by every subsequent server start in this session working correctly).

---

## 8.7 — Silent socket-handler catch blocks now log ✅ fixed

**Fix — applied:** the four bare `catch (error) {}` blocks (`user-status.handler.js` ×2, `message-deleted.handler.js`, `read-receipt.handler.js`) now log via `console.error`, matching the logging style already used elsewhere in the socket handlers (`console.error('[ERROR] ...', error.message)`).

**Verify:**
- [x] Swept `backend/src` for any remaining empty catch blocks after the fix — none found.
- [x] These paths were also exercised (without errors) during this session's live socket testing in earlier files (connect/disconnect, message delete, read receipts all ran successfully) — confirms the added logging doesn't change behavior on the success path, only adds visibility on failure.

---

## 8.8 — Blocking welcome-email send removed from the registration critical path ✅ fixed

**Fix — applied:** `backend/src/controllers/auth.Controller.js`'s `register` no longer `await`s `EmailService.sendWelcomeEmail(...)` before responding — it's fired in the background with `.then()`/`.catch()` logging on failure. (`sendWelcomeEmail` already catches its own internal errors and resolves with `{success:false}` rather than rejecting, so the `.then()` branch checking `result.success` is what actually matters here; `.catch()` is a defensive fallback in case that internal handling ever changes.)

**Verify:**
- [x] Confirmed live and unambiguously: registered a real user against the actual configured (but non-functional in this sandbox) mail providers. Server logs show `"User registered: ..."` — logged essentially right before the response is sent — at `01:01:56`, while the welcome-email attempt (Resend rejects `@example.com` as an invalid test recipient, then falls back to Gmail SMTP, which has no configured credentials here) didn't finish failing until `01:01:57`, a full second later, with my new background failure-logger firing after that. The registration response itself came back in 484ms. The response did not wait on the ~1s+ email attempt chain — exactly the fix's intent.

---

## 8.9 — 50MB body limit

Already fixed as part of [05.1](05-input-validation-and-injection.md#51--no-size-limit-on-messages-and-no-schema-validation-on-most-write-routes-blocker) (dropped to 1mb). No further action here — this entry was always just a cross-reference.

---

## Regression check

Ran the full `bun test` suite after all of the above: 29 pass / 28 fail — identical to the established baseline (same failing tests, same pre-existing reasons, tracked in [09](09-test-suite.md)). No new failures from anything in this file.
