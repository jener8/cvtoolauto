export {
  SUPABASE_CONNECTION_FAILED_BANNER,
  SUPABASE_SERVER_AUTH_INVALID_CREDENTIALS_HINT,
  SUPABASE_SERVER_AUTH_RATE_LIMIT_HINT,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
  getSupabaseServerAuthStatus,
  isSupabaseServerAuthConfigured,
  logSupabaseServerAuthStatusOnce,
  supabaseServerAuthFailureHint,
  type SupabaseServerAuthMissingVar,
  type SupabaseServerAuthStatus,
} from "./server-auth-status"
