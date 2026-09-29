-- Fix RLS policies for interview_questions to allow anonymous access
-- since the app doesn't use Supabase Auth

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;

-- Allow anyone to insert questions (community collection)
CREATE POLICY "Anyone can insert interview questions"
  ON public.interview_questions FOR INSERT
  WITH CHECK (true);

-- Allow anyone to delete questions (for now - the app handles ownership check client-side)
CREATE POLICY "Anyone can delete interview questions"
  ON public.interview_questions FOR DELETE
  USING (true);

-- Allow anyone to update questions (needed for upvoting)
CREATE POLICY "Anyone can update interview questions"
  ON public.interview_questions FOR UPDATE
  USING (true);
