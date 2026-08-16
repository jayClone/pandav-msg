# 03 — Rate limiting is decorative

**Severity:** High (confirms as a real, live-reproduced Blocker-grade gap)
**Source:** security-engineer + backend-architect + **live-verified in this session**
**Status:** ✅ fixed (2026-08-15) — see verification notes below for what was and wasn't re-provable live

## What's wrong

Every Arcjet rate limiter in the app — global, auth, OTP, message — keys its bucket on **one thing only**: the `User-Agent` header.

- `backend/src/middlewares/arcjet.js:11-13` (`globalArcjet`)
- `backend/src/middlewares/arcjet.js:90` (`authArcjet` — 5 attempts/15min on login+register)
- `backend/src/middlewares/arcjet.js:136` (`otpArcjet` — 3/hour on send/verify/resend OTP)
- `backend/src/middlewares/arcjet.js:182` (`messageArcjet` — 50/min)

```js
characteristics: ["http.request.headers['user-agent']"],
```

## Live proof

During manual testing, 3 `POST /api/v1/otp/send-otp` calls from one PowerShell session (`Invoke-RestMethod`, one fixed UA string) triggered:

```json
{"success":false,"message":"Too many OTP requests. Please try again later.","retryAfter":3600}
```

...and every subsequent OTP request **for any email, from any source sharing that UA string**, was blocked for the full hour. The same happened on `/auth/login` after 5 calls.

## Impact

- **Bypassable:** the `User-Agent` header is fully attacker-controlled. Rotating it per request defeats every one of these limits, including brute-force protection on login and OTP verification — the two most abuse-sensitive endpoints in the app.
- **False-positive lockouts:** real users sharing a common UA (the vast majority of any real user base — a handful of browser/OS combinations covers almost everyone) share one collective quota. A handful of legitimate OTP requests can lock out unrelated users for an hour.

## Fix — applied

Added `ip.src` (Arcjet's built-in IP characteristic — confirmed via `node_modules/arcjet/index.d.ts`, whose type comments state characteristics default to `["ip.src"]` and that multiple characteristics are *combined* into one bucket key) to all four limiters in `backend/src/middlewares/arcjet.js`. `trust proxy` is already correctly set in `app.js:18` for the Render deployment, so `req.ip` will resolve to the real client IP in production.

- `globalArcjet` / `authArcjet` / `otpArcjet`: `characteristics: ["ip.src", "http.request.headers['user-agent']"]`.
- `messageArcjet`: `characteristics: ["ip.src", "userId"]` — this one runs *after* `protect` (see `message.routes.js`), so the authenticated user id is already on `req.user` and is a stronger per-account key than IP/UA. `messageArcjet` now passes `userId: req.user?.userId` as a custom prop into `msgAj.protect(req, {...})`.

## Verify

- [x] Server starts cleanly with the new characteristics config — Arcjet initializes without error, `X-RateLimit-*` headers still present on responses.
- [x] Auth rate limiting still functions end-to-end — confirmed live: after exhausting the 5-attempt/15-minute budget during this session's own testing, further login attempts correctly got `429 "Too many login attempts"` (this is the limiter working, not a bug — it's the same reason further live testing below got cut short).
- [ ] **Not re-provable from this environment:** two different real clients (distinct IPs) no longer sharing a bucket. This dev machine only has one outbound IP, and Arcjet's dev mode pins `ip.src` to `127.0.0.1` for everyone locally (see the `"Arcjet will use 127.0.0.1..."` warning in server logs) — so a true cross-IP separation test isn't possible without a second real network path or a staging deployment. The fix's correctness for the IP dimension rests on Arcjet's documented behavior (characteristics are combined into the bucket key, confirmed in the SDK's own type definitions) rather than a fresh live reproduction here.
- [ ] **Blocked mid-verification by hitting my own test budget:** attempted to prove `messageArcjet`'s per-user separation by having two friended test users each send messages and comparing `X-RateLimit-Remaining` — this needs two fresh logins, which ran into the now-correctly-enforced 5/15min `authArcjet` limit from earlier testing in this same session. Left as a follow-up rather than waiting out the 15-minute cooldown or spending more real Arcjet-account quota to reprove vendor-documented combination semantics. **To finish this check:** wait for the auth limiter to reset, log in two friended users, have each send one message, and confirm the second user's very first `X-RateLimit-Remaining` value is fresh (~49) rather than continuing from the first user's count.

## Side note — resolved, see [04.0](04-jwt-session-security.md#40--found-the-running-server-uses-envlocals-placeholder-jwt_secret-not-envs-real-one--root-caused)

While minting a test JWT by hand to work around the `authArcjet` cooldown, a token signed with `.env`'s `JWT_SECRET` was rejected by the running server. Root-caused: Bun auto-loads `.env.local` ahead of `.env`, and `.env.local` has a leftover placeholder `JWT_SECRET` that's silently the one actually in effect. Full writeup and fix moved to file 04 since it's a session/secrets issue, not a rate-limiting one.
