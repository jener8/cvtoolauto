# RLS tighten proposal (`024`)

**Status:** proposal only — **not applied** to live or DEV. Waiting for approval. Test on DEV first; apply `024` to live only on explicit command.

## What it does

| File | Purpose |
|------|---------|
| `source/src/scripts/024_tighten_rls.sql` | Assign any `user_id IS NULL` rows on the four product tables to the app user, set `user_id NOT NULL` + `DEFAULT auth.uid()`, replace `NULL OR owner` RLS with `auth.uid() = user_id` only |
| `source/src/scripts/024_tighten_rls_down.sql` | Restore 013-style nullable + NULL-or-owner policies (does not null out previously assigned owners) |

## Proposed orphan owner (live probe 2026-10-02)

- UUID: `310a80f1-618e-410a-87de-a40c950c98fc`
- Email: `jennygenerate@gmail.com` (`profiles` + `SUPABASE_APP_USER_EMAIL`)

Live `user_id IS NULL` counts at probe time: **0** on `cover_letters`, `folders`, `job_applications`, `resume_versions`.

## Open: `interview_questions`

Left **commented** in `024` pending choice:

- **A** — authenticated own-row CRUD (backfill `user_id`)
- **B** — authenticated read-only shared library (closes `{public}` `true` writes)

Also available historically: `014_drop_interview_questions.sql` if the feature should be removed.
