/** Client-safe copy for Supabase connectivity issues (no env reads). */
export const SUPABASE_CONNECTION_FAILED_BANNER =
  "Supabase connection failed. Existing application data has not been changed."

export const SUPABASE_SERVER_AUTH_SETUP_HINT =
  "Localhost cannot read your cloud database yet. In Vercel → Project Settings → Environment Variables, reveal SUPABASE_APP_USER_EMAIL and SUPABASE_APP_USER_PASSWORD (Production), paste them into .env.local (non-empty values), then restart with npm start. If vercel env pull left them blank, you must copy them manually from the dashboard."
