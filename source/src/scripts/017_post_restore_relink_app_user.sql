-- Post-restore: relink all app data to the Supabase Auth user the app signs in as.
--
-- Run in Supabase Dashboard → SQL Editor AFTER restoring a database backup.
--
-- App login (from .env.local / Vercel):
--   SUPABASE_APP_USER_EMAIL = jennygenerate@gmail.com
--
-- RLS only shows rows where user_id = auth.uid() for the signed-in user.
-- A restored backup often has a different auth.users UUID on every row.
--
-- ---------------------------------------------------------------------------
-- STEP 1 — Preview (run these SELECTs only)
-- ---------------------------------------------------------------------------

-- Who exists in Auth after restore?
-- Dashboard → Authentication → Users (note email + User UID for jennygenerate@gmail.com)

SELECT 'job_applications' AS tbl, user_id, COUNT(*) AS rows
FROM public.job_applications
GROUP BY user_id
UNION ALL
SELECT 'resume_versions', user_id, COUNT(*)
FROM public.resume_versions
GROUP BY user_id
UNION ALL
SELECT 'cover_letters', user_id, COUNT(*)
FROM public.cover_letters
GROUP BY user_id
UNION ALL
SELECT 'folders', user_id, COUNT(*)
FROM public.folders
GROUP BY user_id
ORDER BY tbl, rows DESC;

-- CV content sanity check (should be high after a good backup)
SELECT
  COUNT(*) AS total_resumes,
  COUNT(*) FILTER (WHERE length(trim(coalesce(resume_text, ''))) > 0) AS with_cv_text
FROM public.resume_versions;

-- ---------------------------------------------------------------------------
-- STEP 2 — Set NEW user UUID
-- ---------------------------------------------------------------------------
-- Copy User UID from Authentication → Users → jennygenerate@gmail.com
-- Paste it in all four UPDATE blocks below (replace PASTE-APP-USER-UUID-HERE).

-- ---------------------------------------------------------------------------
-- STEP 3 — Relink all rows to the app user (single-tenant; safe after restore)
-- ---------------------------------------------------------------------------

-- BEGIN;

-- UPDATE public.folders
-- SET user_id = 'PASTE-APP-USER-UUID-HERE'::uuid
-- WHERE user_id IS DISTINCT FROM 'PASTE-APP-USER-UUID-HERE'::uuid;

-- UPDATE public.resume_versions
-- SET user_id = 'PASTE-APP-USER-UUID-HERE'::uuid
-- WHERE user_id IS DISTINCT FROM 'PASTE-APP-USER-UUID-HERE'::uuid;

-- UPDATE public.job_applications
-- SET user_id = 'PASTE-APP-USER-UUID-HERE'::uuid
-- WHERE user_id IS DISTINCT FROM 'PASTE-APP-USER-UUID-HERE'::uuid;

-- UPDATE public.cover_letters
-- SET user_id = 'PASTE-APP-USER-UUID-HERE'::uuid
-- WHERE user_id IS DISTINCT FROM 'PASTE-APP-USER-UUID-HERE'::uuid;

-- Optional: align profiles row if present
-- UPDATE public.profiles
-- SET id = 'PASTE-APP-USER-UUID-HERE'::uuid,
--     email = 'jennygenerate@gmail.com'
-- WHERE email = 'jennygenerate@gmail.com'
--   AND id IS DISTINCT FROM 'PASTE-APP-USER-UUID-HERE'::uuid;
-- (If profiles.id is PK and conflicts, fix manually in Table Editor instead.)

-- COMMIT;

-- ---------------------------------------------------------------------------
-- STEP 4 — Verify (only the app user's UUID should remain)
-- ---------------------------------------------------------------------------

-- SELECT user_id, COUNT(*) FROM public.job_applications GROUP BY user_id;
-- SELECT user_id, COUNT(*) FROM public.resume_versions GROUP BY user_id;

-- ---------------------------------------------------------------------------
-- STEP 5 — Password (if login fails after restore)
-- ---------------------------------------------------------------------------
-- From source/src:
--   SUPABASE_SERVICE_ROLE_KEY="..." \
--   SUPABASE_APP_USER_EMAIL="jennygenerate@gmail.com" \
--   NEW_PASSWORD="..." \
--   node scripts/reset-supabase-app-user-password.mjs
--
-- Then match .env.local + Vercel env and restart the app.

NOTIFY pgrst, 'reload schema';
