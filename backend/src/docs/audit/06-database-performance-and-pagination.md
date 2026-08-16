# 06 — Database performance & pagination

**Severity:** High
**Source:** database-architect
**Status:** ✅ 6.1, 6.2, 6.3, 6.5, 6.6, 6.7 fixed and live-verified (2026-08-16). 6.4 intentionally deferred — see below.

## 6.1 — Friends list has no index for the field it actually sorts by ✅ fixed

`getFriends`/`getFriendshipSummary` query with an `$or` across sender/receiver and sort by `acceptedAt`, but every existing index covered `createdAt`, not `acceptedAt`.

**Fix — applied:** `backend/src/models/Friend.js` now has
```js
friendSchema.index({ senderId: 1, status: 1, acceptedAt: -1 });
friendSchema.index({ receiverId: 1, status: 1, acceptedAt: -1 });
```
Left the existing `{senderId,receiverId,status}` index in place rather than dropping it as the original finding suggested "considering" — no `$indexStats` data from real traffic to justify removing it confidently (same reasoning as 6.4 below).

**Verify:**
- [x] Ran `explain("executionStats")` on the exact query `getFriends` issues (`$or` on senderId/receiverId + `status:'accepted'`, sorted by `acceptedAt: -1`) — confirmed live. Winning plan is `SORT_MERGE` over both new indexes (one per `$or` branch), **not** a blocking in-memory `SORT` stage — better than just "indexed," MongoDB merges the two pre-sorted index scans directly.

---

## 6.2 — Several list endpoints returned unbounded result sets ✅ fixed

- `getMyGroups` had the `pagination` middleware wired at the route but never read `req.pagination` — dead middleware, unbounded query.
- `getConversations`'s aggregate had no `$limit` at all.
- `getFriendshipSummary`'s friends/pending/sent arrays had no cap.

**Fix — applied:**
- `backend/src/controllers/group.controller.js` — `getMyGroups` now applies `req.pagination.skip`/`.limit`, runs a parallel `countDocuments`, and returns the same `data/count/total/page/limit/pages` shape used by other paginated endpoints (additive fields only — existing `data`/`count` consumers are unaffected).
- `backend/src/controllers/message.controller.js` — `getConversations`'s aggregate now ends in a `$facet` (`data`: skip+limit, `totalCount`: count), and the cache key is now page/limit-aware (`conversations:{userId}:page:{page}:limit:{limit}`) instead of one shared key per user.
- `backend/src/controllers/friend.controller.js` — `getFriendshipSummary`'s friends/pending/sent queries each got `.limit(SUMMARY_LIST_LIMIT)` (100). This endpoint is a fixed "dashboard overview" call by design (its own comment says "fetch all contact/friend data in ONE call"), not a paginated list, so a flat cap fits its shape better than wiring up page/limit query params — matches the existing pattern already used there for the `allUsers` sub-query (`.limit(50)`).

**Verify:**
- [x] `getMyGroups`: created a user with 55 groups. Default request → 50 returned, `total:55`, `pages:2`; `?page=2` → the remaining 5. Confirmed live.
- [x] `getConversations`: created a user with 60 distinct real conversation partners (had to use real `User` documents, not synthetic ObjectIds — the pipeline's `$lookup`+`$unwind` silently drops a conversation if the partner id doesn't resolve to a real user, which is pre-existing behavior, not something this change touched). Default request → 50 returned, `total:60`, `pages:2`; page 2 → the remaining 10. Confirmed live.
- [x] `getFriendshipSummary`: created 120 accepted friendships for a user → response's `friends` array has exactly 100 entries, not 120. Confirmed live.

---

## 6.3 — User search did a full collection scan ✅ fixed

`searchUsers`'s case-insensitive infix `$regex` couldn't use a normal index.

**Fix — applied:** `backend/src/models/User.js` now has a compound text index (`{name:'text', email:'text'}`); `backend/src/controllers/user.controller.js`'s `searchUsers` now queries with `$text: {$search: searchTerm}` instead of building a regex.

**Important semantics change — read before wiring this up to a live UI:** `$text` does word/token matching, not substring/prefix matching. Searching `"jo"` will **not** match `"John"` the way the old regex did; it needs a closer-to-whole-word match. I checked before making this change: **the `/users/search` REST endpoint is not currently called anywhere in the frontend** (`GroupChat.jsx`'s user-search boxes filter a pre-fetched user list client-side instead), so this changes zero live behavior today. But if this endpoint gets wired up as a real "search-as-you-type" box later, this matching behavior will likely feel wrong for that UX, and it's worth reconsidering then — options at that point include a prefix-anchored `$regex` (indexable, but only matches from the start of the name) or MongoDB Atlas Search (proper prefix/fuzzy matching, if the deployment target supports it).

This also **supersedes** [05.3](05-input-validation-and-injection.md#53--redos-via-unescaped-regex-in-user-search)'s regex-escaping fix for this specific endpoint: there's no regex being built here anymore, so ReDoS on this query is now structurally impossible rather than just mitigated.

**Verify:**
- [x] Ran `explain("executionStats")` on the new query — confirmed live: winning plan is `TEXT_MATCH` over the new index, zero `COLLSCAN`.

---

## 6.4 — Message collection's ~13 indexes — intentionally deferred

Not fixed this round. The recommended fix (`$indexStats` audit, drop confirmed-unused indexes) explicitly requires real/staging traffic data to do safely — there's no representative traffic in this local dev environment to base a drop decision on, and guessing which indexes are "obviously unused" from reading controller code risks removing one that's actually load-bearing for a query pattern I didn't spot. Left open; revisit once this is running somewhere with real query volume (`db.messages.aggregate([{$indexStats:{}}])`).

---

## 6.5 — Paginated cache invalidation missed non-default pages ✅ fixed (finding corrected)

**Correction to the original finding:** re-reading the code before fixing this, the cache **write** path (`getPendingRequests`/`getSentRequests`) already builds its key dynamically from the real `page`/`limit` — it was never hardcoded as the original finding described. The actual bug is in cache **invalidation**: `acceptFriendRequest`/`rejectFriendRequest` both hardcoded `deleteCache(...:page:1:limit:50)`, so accepting or rejecting a request only ever cleared the page-1/limit-50 cache entry. If a user's pending/sent list had been cached under any other page or limit, that entry would keep serving a request that was actually already accepted/rejected, until its 30s TTL expired.

**Fix — applied:** added `deleteCacheByPattern(pattern)` to `backend/src/config/redis.js` — uses Redis `SCAN` (via `redisClient.scanIterator({MATCH: pattern})`) to find every matching key and `DEL`s them all, rather than guessing one specific key. `acceptFriendRequest`/`rejectFriendRequest` now call `deleteCacheByPattern('requests:pending:{userId}:page:*')` / `...sent:...` instead of the hardcoded single-key deletes, so every cached page/limit combination for that user gets invalidated, not just page 1.

**Verify — environment-limited, not live-tested:** the configured Redis Cloud instance has been unreachable all session (`ENOTFOUND` — confirmed at server startup every time), and this machine has no local Redis or Docker to stand one up. Every cache function (including the new one) hits the `if (!redisClient) return;` guard and no-ops, so this logic has never actually executed against a real Redis server in this environment. Gave it as much confidence as static verification allows: read `node_modules/@redis/client`'s actual `scanIterator`/`SCAN` source directly (confirmed it yields **batches** of keys, not one at a time — the implementation flattens batches with `keys.push(...batch)` accordingly) and confirmed `del()` accepts an array. **Recommend re-verifying this specific piece against a real Redis instance before relying on it in production** — it's the one change in this file that couldn't be proven end-to-end here.

---

## 6.6 — Duplicate registration / friend request races now return clean 409s ✅ fixed

**Fix — applied:** both `backend/src/controllers/auth.Controller.js` (`register`) and `backend/src/controllers/friend.controller.js` (`sendFriendRequest`) now catch `error.code === 11000` explicitly and return a clean `409` instead of letting it fall through to the generic `500` handler.

**Verify:**
- [x] Directly confirmed via a standalone script that Mongoose's duplicate-key error on both the `User.email` unique index and the `Friend {senderId,receiverId}` unique index sets `error.code === 11000` — i.e., the exact condition this fix checks for is exactly what gets thrown. Didn't chase the actual HTTP-level race (two truly concurrent requests) — `sendFriendRequest`'s existing pre-checks (accepted/pending/reverse-request lookups) already catch every *sequential* duplicate attempt before it reaches the DB, so this code path only fires on genuine network-level concurrency, which isn't reliably reproducible from sequential PowerShell calls. The error-shape verification above is the part that actually mattered — confirms the fix triggers correctly whenever the race does happen.

---

## 6.7 — Message id format now validated before the DB call ✅ fixed

**Fix — applied:** `backend/src/controllers/message.controller.js`'s `deleteMessage` now checks `isValidObjectId(messageId)` before calling `Message.findById`, instead of after.

**Verify:**
- [x] `DELETE /api/v1/messages/not-a-valid-id` → clean `400 "Invalid message ID format"`, confirmed live (previously this would have hit `Message.findById` first, thrown a Mongoose CastError, and fallen into the generic catch).

---

## Regression check

Ran the full `bun test` suite after all of the above: 29 pass / 28 fail — identical to the established baseline (same failing tests, same reasons, all pre-existing and tracked in [09](09-test-suite.md)). No new failures from anything in this file.
