-- Add styling columns to resume_versions table
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS profile_photo_border BOOLEAN DEFAULT true;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_bg_color TEXT DEFAULT '#f8f9fa';
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_border_color TEXT DEFAULT '';
