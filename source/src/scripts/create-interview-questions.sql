-- Create interview_questions table for community collection
CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  author_name TEXT DEFAULT 'Anonymous',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read all questions (community collection)
CREATE POLICY "Anyone can view interview questions"
  ON public.interview_questions FOR SELECT
  USING (true);

-- Authenticated users can insert questions
CREATE POLICY "Authenticated users can insert questions"
  ON public.interview_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only delete their own questions
CREATE POLICY "Users can delete their own questions"
  ON public.interview_questions FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own questions
CREATE POLICY "Users can update their own questions"
  ON public.interview_questions FOR UPDATE
  USING (auth.uid() = user_id);
