# RLS tighten (`024`) — Option C for `interview_questions`

**Status:** apply to **DEV only** (`dulpeyutmkhertwrwbqz`) for verification. **Do not apply to live** (`gpbqlxowvwosonatiuac`) until explicit command: `apply 024 to live`.

## What it does

| File | Purpose |
|------|---------|
| `source/src/scripts/024_tighten_rls.sql` | Backfill NULL `user_id` → app owner, set `user_id NOT NULL` + `DEFAULT auth.uid()`, tighten RLS |
| `source/src/scripts/024_tighten_rls_down.sql` | Restore 013-style product policies + pre-024 wide-open IQ policies (does not null out assigned owners) |

## Orphan owner resolution

1. `profiles.id` where `email = jennygenerate@gmail.com`
2. Else `auth.users` with the same email
3. Else live UUID `310a80f1-…` **only if that user exists in this project's `auth.users`**
4. If NULL `user_id` rows exist and no owner resolves → migration raises (create Auth user first)

DEV Auth UUID often differs from live.

## Four product tables

`cover_letters`, `folders`, `job_applications`, `resume_versions`:

- Authenticated **SELECT/INSERT/UPDATE/DELETE** only when `auth.uid() = user_id`
- No anon access; no `NULL` bypass
- Inserts without `user_id` get `DEFAULT auth.uid()`

## `interview_questions` — **Option C** (shared board)

| Op | Who | Rule |
|----|-----|------|
| SELECT | authenticated | **all rows** (`USING (true)`) |
| INSERT | authenticated | `user_id` must equal `auth.uid()`; `DEFAULT auth.uid()` |
| UPDATE | authenticated | own rows only |
| DELETE | authenticated | own rows only |
| — | anon | **no access** |

NULL-owner IQ rows are assigned to the resolved app user before `NOT NULL`.

`024` also runs `CREATE TABLE IF NOT EXISTS public.interview_questions` so DEV projects that never had the community table still get Option C policies.

## Explicit non-goals

- Live project is untouched until you say so.
- Down migration restores prior IQ `{public}` policies for rollback only — do not treat that as the desired long-term state.
