#!/usr/bin/env node
/**
 * Verifies .env.local contains OPENAI_API_KEY (does not print the full key).
 * Run: node scripts/verify-ai-env.mjs
 */
import fs from "fs"
import path from "path"

const envPath = path.join(process.cwd(), ".env.local")

if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found. Create it from .env.example")
  process.exit(1)
}

const content = fs.readFileSync(envPath, "utf8")
const lines = content.split("\n")

function readKey(name) {
  const line = lines.find((l) => l.startsWith(`${name}=`))
  if (!line) return null
  const value = line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "")
  return value || null
}

const openai = readKey("OPENAI_API_KEY")
const model = readKey("OPENAI_MODEL")

console.log("AI environment file check (.env.local)")
console.log("  OPENAI_API_KEY present:", Boolean(openai))
if (openai) {
  console.log("  OPENAI_API_KEY length:", openai.length)
  console.log("  OPENAI_API_KEY prefix:", openai.slice(0, 7) + "…")
}
console.log("  OPENAI_MODEL:", model || "(default: gpt-4o)")
console.log("  ANTHROPIC_API_KEY present:", Boolean(readKey("ANTHROPIC_API_KEY")))
console.log("  AI_GATEWAY_API_KEY present:", Boolean(readKey("AI_GATEWAY_API_KEY")))

if (!openai) {
  console.error(
    "\n❌ AI analysis requires OPENAI_API_KEY. Add it to .env.local (local) or Vercel env vars (production), then restart/redeploy.",
  )
  process.exit(1)
}

console.log("\n✅ OPENAI_API_KEY is set. Restart the dev server if you just added it.")
