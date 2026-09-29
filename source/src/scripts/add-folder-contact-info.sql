-- Add profile_image and contact_info columns to folders table
-- These store default contact info and profile photo for all resumes in the workspace

ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN folders.profile_image IS 'Default profile image (base64) for all resumes in this folder';
COMMENT ON COLUMN folders.contact_info IS 'Default contact information for all resumes in this folder';
