-- Reassign all CV Tool data from an old Supabase Auth user to your current app user.
--
-- WHY: Row Level Security only lets the signed-in user see rows where user_id = auth.uid().
-- The app signs in as SUPABASE_APP_USER_EMAIL (your newest Auth user). If data was saved
-- under an older Auth user, the table looks full in the Dashboard but the app shows 0 from cloud.
--
-- You do NOT need the old user's password — only their UUID from the table or Auth list.
--
-- ---------------------------------------------------------------------------
-- Step 1 — Find UUIDs in Supabase Dashboard
-- ---------------------------------------------------------------------------
-- A) NEW user (the one in .env.local as SUPABASE_APP_USER_EMAIL):
--    Authentication → Users → click that user → copy User UID
--
-- B) OLD user (optional — only if you want a targeted update):
--    Table Editor → job_applications → look at user_id on any row, OR
--    Authentication → Users → copy UID of the older account
--
-- ---------------------------------------------------------------------------
-- Step 2 — Preview what will move (safe to run)
-- ---------------------------------------------------------------------------
-- Replace the UUIDs below, then run SELECT blocks only first.

-- SELECT user_id, COUNT(*) FROM public.job_applications GROUP BY user_id;
-- SELECT user_id, COUNT(*) FROM public.folders GROUP BY user_id;
-- SELECT user_id, COUNT(*) FROM public.resume_versions GROUP BY user_id;
-- SELECT user_id, COUNT(*) FROM public.cover_letters GROUP BY user_id;

-- ---------------------------------------------------------------------------
-- Step 3 — Reassign (pick ONE option)
-- ---------------------------------------------------------------------------

-- OPTION A — Move everything from one old user to the new user (recommended)
-- Replace both UUIDs, then uncomment and run:

-- UPDATE public.folders
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id = 'PASTE-OLD-USER-UUID-HERE';

-- UPDATE public.resume_versions
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id = 'PASTE-OLD-USER-UUID-HERE';

-- UPDATE public.job_applications
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id = 'PASTE-OLD-USER-UUID-HERE';

-- UPDATE public.cover_letters
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id = 'PASTE-OLD-USER-UUID-HERE';

-- OPTION B — Attach ALL rows to the new user (single-tenant app; simplest)
-- Use when you only care about one service account and want every row visible to it.

-- UPDATE public.folders
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id IS DISTINCT FROM 'PASTE-NEW-USER-UUID-HERE';

-- UPDATE public.resume_versions
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id IS DISTINCT FROM 'PASTE-NEW-USER-UUID-HERE';

-- UPDATE public.job_applications
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id IS DISTINCT FROM 'PASTE-NEW-USER-UUID-HERE';

-- UPDATE public.cover_letters
--   SET user_id = 'PASTE-NEW-USER-UUID-HERE'
--   WHERE user_id IS DISTINCT FROM 'PASTE-NEW-USER-UUID-HERE';

-- ---------------------------------------------------------------------------
-- Step 4 — Verify
-- ---------------------------------------------------------------------------

-- SELECT user_id, COUNT(*) FROM public.job_applications GROUP BY user_id;
-- Should show only the NEW user UUID (or NULL + NEW if any legacy NULL rows remain).

NOTIFY pgrst, 'reload schema';
