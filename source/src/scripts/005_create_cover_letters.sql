-- Create cover_letters table for standalone cover letters (not tied to job applications)
CREATE TABLE IF NOT EXISTS cover_letters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content_en TEXT,
  content_de TEXT,
  contact_person_name TEXT,
  folder_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
