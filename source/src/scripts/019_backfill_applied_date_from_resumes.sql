-- Backfill applied_date from linked resume_versions when restore reset dates.
-- Run once in Supabase SQL editor after reviewing a few rows.

UPDATE job_applications ja
SET
  applied_date = rv.created_at,
  updated_at = now()
FROM resume_versions rv
WHERE rv.application_id = ja.id::text
  AND rv.created_at IS NOT NULL
  AND (
    ja.applied_date IS NULL
    OR ja.applied_date > rv.created_at + interval '1 day'
  );

-- Rebuild shallow pipelines from legacy status when interview dates exist.
UPDATE job_applications ja
SET
  job_description = jsonb_set(
    COALESCE(ja.job_description, '{}'::jsonb),
    '{pipeline}',
    CASE ja.status
      WHEN 'interview_invited' THEN jsonb_build_array(
        jsonb_build_object('stage', 'applied', 'outcome', 'passed', 'date', ja.applied_date),
        jsonb_build_object(
          'stage', 'hr_screening',
          'outcome', 'pending',
          'date', ja.job_description->>'firstInterviewDate'
        )
      )
      WHEN 'interview_completed' THEN jsonb_build_array(
        jsonb_build_object('stage', 'applied', 'outcome', 'passed', 'date', ja.applied_date),
        jsonb_build_object(
          'stage', 'hr_screening',
          'outcome', 'passed',
          'date', ja.job_description->>'firstInterviewDate'
        ),
        jsonb_build_object('stage', 'hiring_manager_interview_1', 'outcome', 'pending')
      )
      WHEN 'rejected' THEN jsonb_build_array(
        jsonb_build_object(
          'stage', 'applied',
          'outcome', 'rejected',
          'date', COALESCE(ja.job_description->>'rejectionDate', ja.applied_date::text)
        )
      )
      ELSE ja.job_description->'pipeline'
    END,
    true
  ),
  updated_at = now()
WHERE ja.status IN ('interview_invited', 'interview_completed', 'rejected', 'offer_received')
  AND (
    ja.job_description->'pipeline' IS NULL
    OR jsonb_array_length(ja.job_description->'pipeline') = 0
    OR (
      jsonb_array_length(ja.job_description->'pipeline') = 1
      AND ja.job_description->'pipeline'->0->>'stage' = 'applied'
      AND ja.job_description->'pipeline'->0->>'outcome' = 'pending'
    )
  );
