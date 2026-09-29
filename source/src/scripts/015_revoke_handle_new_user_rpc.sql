-- handle_new_user() is only meant to run from the auth.users signup trigger.
-- Revoke direct RPC access so anon/authenticated cannot call it via PostgREST.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
