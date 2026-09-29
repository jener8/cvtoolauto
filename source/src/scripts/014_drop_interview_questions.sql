-- Remove unused community interview_questions table (feature removed from app design).
-- Run in Supabase SQL Editor to clear rls_policy_always_true linter warnings.

DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;

DROP TABLE IF EXISTS public.interview_questions;
