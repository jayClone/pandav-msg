## Frontend (React + Redux/RTK)

- **Adopt RTK Query for API calls**: built-in caching, deduped requests, automatic revalidation. Replace ad-hoc axios calls in `services/*.js` with RTK Query slices.
- **Memoize + selector hygiene**: use `useMemo`, `useCallback`, and reselect selectors. Avoid passing fresh inline objects/arrays into children; prefer IDs and lookups.
- **Virtualize large lists**: groups, members, messages using `react-window` / `react-virtualized` to render only visible items.
- **Pagination + infinite scroll**: don't load all messages at once. Fetch paged (30–50) and append on scroll. Same for group lists and members.
- **Debounce/throttle search inputs**: user search, group search to 250–400ms to cut API spam.
- **Code-split heavy routes**: lazy-load GroupChat, Chat, Register, Login. Keep above-the-fold small.
- **Reduce rerenders**: lift state thoughtfully, avoid storing derived data in state, prefer primitive dependencies for effects.
- **Trim runtime logging**: strip verbose console logs in production; keep a single guarded logger.
- **Socket efficiency**: Use `['websocket']` only, keep reconnection but raise `reconnectionAttempts`, guard listeners to avoid double-registration, remove on unmount, batch UI updates.
- **Static assets**: ensure gzip/br compression, serve images/WebP, tree-shake unused icons.

### Redux Efficiency Specifics

- Use Redux Toolkit throughout; avoid manual reducers/immer copies.
- Use RTK Query for all CRUD: groups, messages, users, friends, OTP. Coalesce duplicate requests.
- Normalize entities (groups, users, messages) in slices to avoid O(n) scans.
- Use `selectFromResult` in RTK Query to minimize rerenders per component.

## Backend (Express + MongoDB)

- **Indexes**: ensure query-match indexes on:
    - Messages: `{groupId:1, createdAt:1}`, `{senderId:1, receiverId:1, createdAt:1}`
    - Groups: `{participants:1}`, `{adminId:1}`
    - Users: `{email:1}` (unique), `{name:1}` if searching by name
- **Lean + projection**: use `.lean()` on read paths, project only needed fields.
- **Pagination everywhere**: `/messages`, `/groups`, `/users/search` should be limited/paged.
- **Cache hot reads**: short TTL cache (Redis) for users, `/groups/:id` metadata, friend lists.
- **Compression**: add compression middleware (skip already-compressed).
- **Cut noisy logs**: remove body dumps and heavy console logs; keep error/info via Winston only.
- **Timeouts & retries**: for OTP/email, add 8–10s timeouts and fallbacks (Resend → Gmail).
- **Socket server**: enable `perMessageDeflate`, reduce log spam, ensure sticky sessions in production.
- **DB connection pooling**: let Mongoose use defaults; avoid creating multiple connections.