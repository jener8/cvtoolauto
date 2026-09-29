/**
 * Set a new password for the Supabase app service user (no recovery email).
 *
 * 1. Supabase Dashboard → Project Settings → API → copy "service_role" secret
 * 2. Run (replace values):
 *
 *    SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret" \
 *    SUPABASE_APP_USER_EMAIL="cv-app@example.com" \
 *    NEW_PASSWORD="your-new-long-password" \
 *    node scripts/reset-supabase-app-user-password.mjs
 *
 * 3. Put the same email + password in .env.local and Vercel env vars
 * 4. Restart: npm run build && npm start
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"

function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const fileEnv = loadEnvFile(".env.local")
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  fileEnv.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const email =
  process.env.SUPABASE_APP_USER_EMAIL?.trim() ||
  fileEnv.SUPABASE_APP_USER_EMAIL?.trim()
const newPassword = process.env.NEW_PASSWORD?.trim()

if (!url) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL")
  process.exit(1)
}
if (!serviceRoleKey) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Copy it from Supabase → Project Settings → API → service_role (secret).",
  )
  process.exit(1)
}

if (
  serviceRoleKey.startsWith("sb_publishable_") ||
  serviceRoleKey === fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
) {
  console.error(
    "You pasted the PUBLISHABLE (anon) key. The script needs the SECRET (service_role) key instead.",
  )
  console.error("Supabase → Settings → API Keys → Secret key (starts with sb_secret_… or legacy JWT).")
  process.exit(1)
}

console.log("Using Supabase project URL:", url)
console.log(
  "Key looks like:",
  serviceRoleKey.startsWith("sb_secret_")
    ? "secret (new format) ✓"
    : serviceRoleKey.startsWith("eyJ")
      ? "service_role JWT (legacy) ✓"
      : "unknown format — double-check you copied the secret key",
)
if (!email) {
  console.error(
    "Missing SUPABASE_APP_USER_EMAIL. Use the email shown on the user in Authentication → Users.",
  )
  process.exit(1)
}
if (!newPassword || newPassword.length < 12) {
  console.error("Set NEW_PASSWORD to a new password (at least 12 characters).")
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
})

if (listError) {
  console.error("Could not list users:", listError.message)
  console.error("")
  console.error("Common fixes:")
  console.error("- Open the Supabase project that matches:", url)
  console.error("  (your app uses gpbqlxowvwosonatiuac — not a different project name)")
  console.error("- Copy the SECRET / service_role key, NOT the publishable / anon key")
  console.error("- Paste the full key with no spaces or line breaks")
  process.exit(1)
}

const user = listed.users.find(
  (row) => row.email?.trim().toLowerCase() === email.toLowerCase(),
)

if (!user) {
  console.error(`No auth user found with email: ${email}`)
  console.error("Users in project:", listed.users.map((u) => u.email).filter(Boolean).join(", ") || "(none)")
  process.exit(1)
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password: newPassword,
})

if (updateError) {
  console.error("Password update failed:", updateError.message)
  process.exit(1)
}

console.log("Password updated successfully for:", user.email)
console.log("User UID (for reference only, not a password):", user.id)
console.log("")
console.log("Next steps:")
console.log("1. Add to .env.local:")
console.log(`   SUPABASE_APP_USER_EMAIL="${user.email}"`)
console.log("   SUPABASE_APP_USER_PASSWORD=\"<same NEW_PASSWORD you used>\"")
console.log("2. Update the same values in Vercel → Environment Variables (Production + Preview)")
console.log("3. Redeploy production, then: npm run build && npm start")
