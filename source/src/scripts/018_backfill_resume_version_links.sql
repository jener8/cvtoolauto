-- Backfill job_applications.resume_version_id from resume_versions.application_id
-- when the CV exists but the application row never got the FK saved.
--
-- "Broken" (bad ID) ≠ "Unlinked" (NULL resume_version_id). This fixes unlinked rows.

-- ---------------------------------------------------------------------------
-- Step 1 — See the full picture
-- ---------------------------------------------------------------------------

SELECT
  COUNT(*) AS total_apps,
  COUNT(*) FILTER (WHERE trim(coalesce(resume_version_id, '')) <> '') AS has_resume_version_id,
  COUNT(*) FILTER (WHERE trim(coalesce(resume_version_id, '')) = '') AS missing_link
FROM job_applications;

-- Broken: ID set but resume missing or empty
SELECT ja.id, ja.company, ja.role, ja.resume_version_id
FROM job_applications ja
LEFT JOIN resume_versions rv ON rv.id::text = trim(ja.resume_version_id)
WHERE trim(coalesce(ja.resume_version_id, '')) <> ''
  AND (rv.id IS NULL OR length(trim(coalesce(rv.resume_text, ''))) = 0);

-- Fixable: CV row points at this application via application_id, but app has no link
SELECT
  ja.id AS application_id,
  ja.company,
  ja.role,
  rv.id AS resume_id,
  rv.name AS resume_name,
  length(trim(coalesce(rv.resume_text, ''))) AS text_len
FROM job_applications ja
JOIN resume_versions rv ON rv.application_id = ja.id
WHERE trim(coalesce(ja.resume_version_id, '')) = ''
  AND length(trim(coalesce(rv.resume_text, ''))) > 0;

-- ---------------------------------------------------------------------------
-- Step 2 — Backfill fixable links (preview with SELECT, then uncomment UPDATE)
-- ---------------------------------------------------------------------------

-- UPDATE job_applications ja
-- SET resume_version_id = rv.id::text,
--     updated_at = now()
-- FROM resume_versions rv
-- WHERE rv.application_id = ja.id
--   AND length(trim(coalesce(rv.resume_text, ''))) > 0
--   AND trim(coalesce(ja.resume_version_id, '')) = '';

-- ---------------------------------------------------------------------------
-- Step 3 — Clear only truly broken IDs (optional; 2 rows from your check)
-- ---------------------------------------------------------------------------

-- UPDATE job_applications ja
-- SET resume_version_id = NULL,
--     updated_at = now()
-- FROM job_applications ja2
-- LEFT JOIN resume_versions rv ON rv.id::text = trim(ja2.resume_version_id)
-- WHERE ja.id = ja2.id
--   AND trim(coalesce(ja2.resume_version_id, '')) <> ''
--   AND (rv.id IS NULL OR length(trim(coalesce(rv.resume_text, ''))) = 0);

-- ---------------------------------------------------------------------------
-- Step 4 — Verify
-- ---------------------------------------------------------------------------

-- SELECT COUNT(*) AS still_unlinked
-- FROM job_applications ja
-- WHERE trim(coalesce(ja.resume_version_id, '')) = ''
--   AND EXISTS (
--     SELECT 1 FROM resume_versions rv
--     WHERE rv.application_id = ja.id
--       AND length(trim(coalesce(rv.resume_text, ''))) > 0
--   );

NOTIFY pgrst, 'reload schema';
