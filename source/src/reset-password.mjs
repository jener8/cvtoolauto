import fs from "fs";
import crypto from "crypto";

const f = ".env.local";
let txt = fs.readFileSync(f, "utf8");
const env = {};
for (const line of txt.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.SUPABASE_APP_USER_EMAIL;

console.log("Project:", url);
console.log("Email:", email);
if (!key) { console.log("STOP: no SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }

const headers = { apikey: key, "Content-Type": "application/json" };
if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;

let user;
for (let page = 1; page < 20 && !user; page++) {
  const r = await fetch(`${url}/auth/v1/admin/users?per_page=200&page=${page}`, { headers });
  const j = await r.json();
  if (!j.users || !j.users.length) {
    if (page === 1) console.log("Supabase answered:", JSON.stringify(j));
    break;
  }
  user = j.users.find(u => (u.email || "").toLowerCase() === email.toLowerCase());
}
if (!user) { console.log("STOP: user not found:", email); process.exit(1); }

const pw = crypto.randomBytes(18).toString("base64url");
const r = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: "PUT", headers, body: JSON.stringify({ password: pw }),
});
if (!r.ok) { console.log("STOP: update failed", r.status, await r.text()); process.exit(1); }

txt = /^SUPABASE_APP_USER_PASSWORD=.*$/m.test(txt)
  ? txt.replace(/^SUPABASE_APP_USER_PASSWORD=.*$/m, "SUPABASE_APP_USER_PASSWORD=" + pw)
  : txt + "\nSUPABASE_APP_USER_PASSWORD=" + pw + "\n";
fs.writeFileSync(f, txt);

console.log("DONE: password updated and saved to .env.local");
console.log("NEW PASSWORD for Vercel (do not share):", pw);