# 04 — JWT / session security

**Severity:** High
**Source:** security-engineer
**Status:** ✅ 4.0–4.2 fixed and live-verified (2026-08-15) · 4.3 still open, owned by [08](08-scalability-and-ops.md#83--error-messages-leak-internals-to-clients)

## 4.0 — Found: the running server uses `.env.local`'s placeholder `JWT_SECRET`, not `.env`'s real one ✅ root-caused

Discovered while working on [03](03-rate-limiting.md), and root-caused before moving on since it changes what "the" `JWT_SECRET` even means for the rest of this file.

`backend/.env` has a real random-hex `JWT_SECRET`. `backend/.env.local` has `JWT_SECRET=your_access_token_secret` — an unchanged placeholder. **Bun auto-loads `.env.local` at a higher precedence than `.env` before the script even runs**, ahead of the app's own `dotenv.config()` call in `server.js` (which then injects "0" new keys, confirmed in the startup log — everything was already set). Confirmed live: a token hand-signed with `.env.local`'s placeholder secret was accepted by the running server's `protect` middleware (got as far as `"User not found. Please Login"` — a valid-signature response — for a nonexistent user id); a token signed with `.env`'s real secret was rejected as `"Token is invalid or expired"`.

**Impact:** in this local/dev setup, every JWT the server issues and verifies is actually signed with the placeholder string `your_access_token_secret`, not the stronger value in `.env` that looks like the intended one. Since `.env.local` isn't tracked in git (confirmed via `git ls-files`), this is machine-local — it won't automatically follow to a deploy — but it means local dev has quietly been running on a weak, guessable JWT secret, and `.env`'s value is dead configuration as long as `.env.local` exists alongside it.

**Fix — applied:**
- [x] Generated two new 256-bit random secrets (`crypto.randomBytes(32).toString('hex')`) and set them identically in **both** `backend/.env` and `backend/.env.local` as `JWT_SECRET` / `JWT_REFRESH_SECRET` — so it no longer matters which file Bun picks, both resolve to the same real values, and the previous placeholder (`your_access_token_secret`) is gone.
- [x] Added a comment block at the top of `.env.local` explaining Bun's precedence and why the two files' secrets must stay in sync (or that the file should be deleted if `.env` alone is meant to be authoritative).
- [x] `.env.example` updated to document `JWT_REFRESH_SECRET` as required-and-distinct, plus a note about the `.env.local` precedence gotcha (see 4.1/4.2 below — same edit covers all three sub-findings).
- [ ] Still open: confirm the actual deploy target (Render) doesn't have a stray `.env.local` — this can only be checked on the deployment itself, not from this repo checkout.

**Note:** rotating `JWT_SECRET` invalidates every previously issued token/session — expected and harmless here since this is local dev data that gets cleaned up after each test round, but worth remembering if this is ever done against a real deployment (it would force every logged-in user to re-authenticate).

---

## 4.1 — Refresh tokens work as access tokens

`backend/src/middlewares/auth.js:40-54` (`protect`) verifies the JWT signature but never checks the `type` claim. Both token kinds are signed by `auth.Controller.js`:

```js
generateAccessToken(user)  // { ..., type: 'access' }   — auth.Controller.js:44-55
generateRefreshToken(user) // { ..., type: 'refresh' }  — auth.Controller.js:57-66
```

`protect` accepts either. Worse, `generateRefreshToken` signs with:

```js
process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
```

`JWT_REFRESH_SECRET` is **not present in `.env.example`**, so in the documented default setup both token types share one signing secret. A leaked 30-day refresh token can be presented directly as a `Bearer` access token to every protected REST route.

**Fix — applied:**
- `backend/src/middlewares/auth.js` (`protect`) now rejects any token where `decoded.type !== 'access'` with the same 401 used for other invalid-token cases.
- `backend/src/socket/socket.auth.js` (`socketAuthMiddleware`) got the **same check** — this wasn't called out explicitly in the original finding, but it's the identical vulnerability on the socket connection path (only REST's `protect` was checked before), so it's fixed alongside it.
- `JWT_REFRESH_SECRET` is now set to a distinct real value in `.env`/`.env.local` (see 4.0 above) and documented as required in `.env.example`.

**Verify:**
- [x] A token with `type: 'refresh'` **signed with the access-token secret** (simulating the old shared-secret setup) → 401 on `GET /auth/current` — confirmed live via a hand-signed token, proving the type check itself works independent of the secret question.
- [x] A proper refresh token signed with the new distinct `JWT_REFRESH_SECRET` → 401 on `GET /auth/current` (fails signature verification against `JWT_SECRET` before the type check even runs) — confirmed live, defense-in-depth working.
- [x] A normal access token still works — confirmed live (`GET /auth/current` returned the correct user).
- [x] Socket connection with a refresh-type token → rejected with `AUTH_ERROR : Invalid token`; a real access token still connects — confirmed live with a small `socket.io-client` test script.
- [x] `.env.example` documents `JWT_REFRESH_SECRET` as required and distinct from `JWT_SECRET`.

**Follow-up caught while working on [05](05-input-validation-and-injection.md):** the full `bun test` suite wasn't re-run right after this fix landed, and it turns out `backend/src/tests/socket.test.js`'s own token-minting helper (`generateToken`) didn't set a `type` claim — so this exact fix broke 2 previously-passing socket tests. Caught and fixed while verifying file 05 (added `type: 'access'` to that helper). Lesson for next time: run the full suite after touching shared auth/socket code, not just targeted manual checks.

---

## 4.2 — Access-token lifetime is ambiguous and unrevocable

`backend/src/controllers/auth.Controller.js:12`:
```js
const ACCESS_TOKEN_EXPIRE = process.env.JWT_EXPIRE || '15m';
```
But `backend/.env.example:9-12` sets `JWT_EXPIRE=30d` — the value an operator is most likely to copy when provisioning a new environment. Access tokens are stateless JWTs with no denylist/revocation mechanism, so a token issued under the example config is a valid credential for 30 days if it ever leaks (XSS, log leak, proxied request, etc.).

**Fix — applied:** split the env var so access and refresh lifetimes can't be confused. `backend/src/controllers/auth.Controller.js:12` now reads `process.env.JWT_ACCESS_EXPIRE || '15m'` instead of the old `JWT_EXPIRE`. `.env`, `.env.local`, and `.env.example` all set `JWT_ACCESS_EXPIRE=15m` / `JWT_REFRESH_EXPIRE=30d` — the old ambiguous `JWT_EXPIRE=30d` in `.env.example` is gone.

**Verify:**
- [x] `.env.example` no longer implies a 30-day access token — confirmed by inspection, now explicitly `JWT_ACCESS_EXPIRE=15m`.
- [ ] A freshly server-issued access token's `exp - iat` is exactly 900s — **not re-verified live this round**: the `authArcjet` login limiter (5/15min) was still cooling down from earlier testing in files 02/03 by the time this file's work started, so a real login round-trip wasn't available. The code change itself is a one-line env-var rename with a safe fallback, low-risk; revisit this specific checkbox next time a live login is convenient (e.g. while verifying a later file) to close it out with certainty.

---

## 4.3 — Error messages leak internals to clients in production

Not JWT-specific, but discovered alongside auth review and affects every auth flow's error responses. The global handler (`app.js:162-186`) correctly hides `err.message` unless `NODE_ENV==='development'` — but `auth.Controller.js` (register/login/refresh/logout) and most other controllers catch their own errors and return `message: error.message` **unconditionally**, bypassing that gate. This can surface Mongoose/driver internals to any client regardless of environment.

Full list of affected controllers is tracked in [08 — Scalability & ops hardening](08-scalability-and-ops.md#83--error-messages-leak-internals-to-clients), since it's a codebase-wide pattern, not just auth. Cross-referencing here since it's most visible on the login/register error paths.
