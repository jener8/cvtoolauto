/** Client-safe copy for Supabase connectivity issues (no env reads). */
export const SUPABASE_CONNECTION_FAILED_BANNER =
  "Supabase connection failed. Existing application data has not been changed."

export const SUPABASE_SERVER_AUTH_SETUP_HINT =
  "Localhost cannot read your cloud database yet. In Vercel → Project Settings → Environment Variables, reveal SUPABASE_APP_USER_EMAIL and SUPABASE_APP_USER_PASSWORD (Production), paste them into .env.local (non-empty values), then restart with npm start. If vercel env pull left them blank, you must copy them manually from the dashboard."

export const SUPABASE_SERVER_AUTH_INVALID_CREDENTIALS_HINT =
  "SUPABASE_APP_USER_EMAIL and SUPABASE_APP_USER_PASSWORD are set locally, but Supabase rejected the login (invalid credentials). In Vercel → Project Settings → Environment Variables (Production), reveal both values again and paste the exact email and Auth user password into source/src/.env.local — not the anon key or service role key. Then restart the dev server (npm run dev) or production server (npm start)."

export const SUPABASE_SERVER_AUTH_RATE_LIMIT_HINT =
  "Supabase temporarily blocked sign-in because too many login attempts were made at once. Wait 1–2 minutes, stop the dev server (Ctrl+C), run npm run dev again, then hard-refresh the browser (Cmd+Shift+R). Your password is probably correct — this is a rate limit, not bad credentials."

export function supabaseServerAuthFailureHint(errorMessage?: string | null): string {
  if (errorMessage && /rate limit/i.test(errorMessage)) {
    return SUPABASE_SERVER_AUTH_RATE_LIMIT_HINT
  }
  return SUPABASE_SERVER_AUTH_INVALID_CREDENTIALS_HINT
}
