# 10 — Repo hygiene / secrets

**Severity:** Low (but cheap, and worth doing before anything else if you haven't)
**Source:** direct inspection of `.gitignore` files (root + `backend/` + `frontend/`) and `git ls-files` / `git log --all --full-history`
**Status:** ✅ fixed

## What was actually found

Re-checked this from scratch rather than trusting the original finding at face value, since the original write-up only inspected the **root** `.gitignore`.

- `backend/.env`, `backend/.env.local`, `frontend/.env`, `frontend/.env.local` all hold real values (Resend API key, a Redis connection string with an embedded password, a live Arcjet key, etc.).
- None of them have ever been committed: `git log --all --full-history -- "**/.env" "**/.env.local"` returns nothing across all branches. `git ls-files | grep env` shows only `backend/.env.example`, `backend/.env.test`, and `frontend/.env.example` are tracked — all placeholder/non-sensitive.
- **Correction to the original finding:** `backend/.gitignore` and `frontend/.gitignore` already exist, are already committed, and already correctly exclude `.env`, `.env.local`, and `node_modules` (`backend/.gitignore` lines 2, 19, 23; `frontend/.gitignore` lines 10, 13, 25 via the `*.local` pattern). Git applies the nearest `.gitignore` up the directory tree, so these nested files were already doing the real protective work — confirmed live with `git check-ignore -v backend/.env frontend/.env backend/node_modules frontend/node_modules`, all four matched.
- The **root** `.gitignore` was genuinely thin (a single line, `skills`) — but since no `.env` file or `node_modules` directory lives at the repo root itself (confirmed: only `backend/`, `frontend/`, `skills/`, `.github/`, plus a handful of root-level docs/config files), this wasn't actually a live gap, just a missing layer of defense-in-depth.

So the real risk here was lower than originally described — but "add the root-level rule anyway" is still correct given it costs nothing and protects against a future root-level `.env` or `node_modules` (e.g. from a root-level `package.json` added later).

## Fix — applied

Added to `.gitignore` (repo root):

```gitignore
skills

# environment files (real secrets — never commit)
.env
.env.local
.env.*.local

# dependency directories
node_modules/

# logs
*.log

# editor/OS noise
.DS_Store
```

`backend/.gitignore` and `frontend/.gitignore` were left untouched — they were already correct.

## Verify

- [x] `git check-ignore -v backend/.env` → matches `backend/.gitignore:19:.env`.
- [x] `git check-ignore -v frontend/.env` → matches `frontend/.gitignore:25:.env`.
- [x] `git check-ignore -v backend/node_modules` / `frontend/node_modules` → both matched by their respective `.gitignore`.
- [x] `git log --all --full-history -- "**/.env" "**/.env.local"` → empty, confirms no real secret has ever entered history on any branch.
- [x] `git ls-files | grep env` → only the three placeholder files (`backend/.env.example`, `backend/.env.test`, `frontend/.env.example`) are tracked.

## Separate, lower-priority note — still open, needs the user

Since `RESEND_API_KEY` and `ARCJET_KEY` values were read directly during this audit (they're plaintext in `.env`), and even though they were never exposed outside this local environment or committed to git, it's good practice to rotate them if there's any doubt about who else has had access to this machine/checkout. Not urgent, and not something that can be done as part of this remediation pass — rotating a live third-party API key is an action only the account owner can take.
