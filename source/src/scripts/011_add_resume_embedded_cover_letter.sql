-- Store per-resume cover letter on the resume row (scoped by resume id)
ALTER TABLE resume_versions
ADD COLUMN IF NOT EXISTS resume_cover_letter JSONB DEFAULT NULL;

COMMENT ON COLUMN resume_versions.resume_cover_letter IS 'Cover letter content belonging to this resume only';
