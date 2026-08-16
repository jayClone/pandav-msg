# Backend Audit — Remediation Tracker

**Date:** 2026-08-15
**Scope:** `backend/src/**` (frontend not reviewed) — with one explicit, user-approved exception: [07.3](07-data-integrity-and-concurrency.md#73--group-chat-was-stored-in-cleartext--implemented-pairwise-fan-out-e2ee) (group E2EE) required real client-side crypto, so it touches `frontend/src/services/crypto.service.js` and `frontend/src/pages/GroupChat.jsx` too — asked before doing so, not assumed.
**Method:** live HTTP testing against a running instance + local MongoDB, a full `bun test` run, and full-checklist audits from the `security-engineer`, `backend-architect`, and `database-architect` skills.
**Verdict:** All 10 items fixed & (re-)verified as of 2026-08-16 — see individual files for the handful of documented deferrals/environment limitations (6.4, 6.5, 7.2, 8.1, 8.2). Originally NOT PRODUCTION-READY (3 blockers: 01, 05, 07) — all three closed.

> ⚠️ `../security.md` in this same docs folder claims "Security Grade A+ (98/100)", "167/167 tests passing", and "Production Approved". It describes an earlier/different version of this code (single JWT, 10kb body limit, `express-rate-limit`) and does not match what's actually running today (dual access/refresh tokens, 50mb body limit, Arcjet). Don't trust it until these findings are closed out and it's rewritten to match reality.

## How to use this folder

Each file below is one unit of work: what's wrong, why it matters, where, how to fix it, and how to confirm the fix. Work through them in order — later files assume earlier ones are done where noted. Check items off as they land.

## Progress

- [x] [01 — Group message authorization](01-group-message-authorization.md) — **Blocker** — fixed & live-verified 2026-08-15
- [x] [02 — Access control gaps (IDOR)](02-access-control-gaps.md) — High — 2.1–2.3 fixed & live-verified 2026-08-15, 2.4 closed (required for E2EE)
- [x] [03 — Rate limiting is decorative](03-rate-limiting.md) — High *(live-confirmed bug, fixed 2026-08-15 — cross-IP/cross-user separation only partly re-verifiable locally, see file for details)*
- [x] [04 — JWT / session security](04-jwt-session-security.md) — High — 4.0–4.2 fixed & live-verified 2026-08-15 (4.3 deferred to 08)
- [x] [05 — Input validation & injection hardening](05-input-validation-and-injection.md) — **Blocker** + Medium — fixed & live-verified 2026-08-16 (found & fixed a real test regression along the way — see file for details)
- [x] [06 — Database performance & pagination](06-database-performance-and-pagination.md) — High — fixed & live-verified 2026-08-16 (6.4 intentionally deferred; 6.5 couldn't be tested against a real Redis — see file)
- [x] [07 — Data integrity & concurrency](07-data-integrity-and-concurrency.md) — **Blocker** + Medium — 7.1 & 7.3 fixed & live-verified 2026-08-16 (7.3 is a real feature: group E2EE, backend **and** frontend — see file); 7.2 deferred; 7.4 resolved with no code change
- [x] [08 — Scalability & ops hardening](08-scalability-and-ops.md) — High — fixed 2026-08-16; 8.1's Redis pub/sub delivery and 8.2's graceful shutdown couldn't be end-to-end verified in this environment (unreachable Redis; Windows can't deliver a catchable SIGTERM to another process) — see file for what *was* proven and why
- [x] [09 — Test suite fixes](09-test-suite.md) — Medium/Low — fixed 2026-08-16; full suite now 163/163 (was 29/57), plus owed regression tests for 01/02/04/05 and a real full-suite flake (shared mongoose connection) found & fixed along the way
- [x] [10 — Repo hygiene / secrets](10-repo-hygiene-secrets.md) — Low — fixed 2026-08-16 (original finding partly corrected: `backend/`&`frontend/`'s own `.gitignore` files already protected secrets; root-level rule added anyway as defense-in-depth; confirmed no secret has ever entered git history)

## Suggested order

1. **01** then **02** — same file family (message/socket access control), ship together.
2. **03** — closes the brute-force/OTP-abuse gap; small, isolated.
3. **04** — auth/session hardening.
4. **05** — do before adding new endpoints; establishes the validation baseline everything else should follow.
5. **06** — cheap index/query fixes, prevents a slow-burn outage as data grows.
6. **07** — needs more care (touches concurrent writes); do after the quicker wins above.
7. **08** — operational hardening, best done right before/around a scaling or deploy change.
8. **09** and **10** — no dependency on the others, pick up anytime, good for a quick win.

## What's already solid (don't touch without reason)

- Refresh-token theft detection (hash comparison + revocation on mismatch) — `auth.Controller.js`
- Refresh cookie flags (`httpOnly`, `secure` in prod, `sameSite:lax`)
- bcrypt password hashing + `select:false` on `password`/`refreshToken`, respected everywhere
- Object-level authorization in `group.controller.js` / `friend.controller.js` (the group-message-send gap in file 01 is the outlier, not the norm)
- OTP attempt counter + genuine Mongo TTL index for expiry
- Redis cache fails open safely everywhere (confirmed live when the configured Redis host was unreachable)
- Cursor-based pagination on message history (both private and group)
- `.env`/`.env.local` are not in git history — only non-sensitive `.env.example`/`.env.test` are tracked
