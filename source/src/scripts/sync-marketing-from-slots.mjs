/**
 * Copy marketing illustration slots into public/marketing/ with legacy filenames.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const SLOTS = path.join(ROOT, "public/illustrations/slots")
const MARKETING = path.join(ROOT, "public/marketing")

const MARKETING_MAP = {
  "hero-platform-core.png": "marketing-heroPlatform.png",
  "equity-opportunity.png": "marketing-equity.png",
  "trust-shield.png": "marketing-trustShield.png",
  "bespoke-lab.png": "marketing-bespokeLab.png",
  "cv-templates.png": "marketing-cvTemplates.png",
  "hero-person-gem.png": "section-mentoringSupport.png",
}

fs.mkdirSync(MARKETING, { recursive: true })

for (const [legacyName, slotName] of Object.entries(MARKETING_MAP)) {
  const src = path.join(SLOTS, slotName)
  const dest = path.join(MARKETING, legacyName)
  if (!fs.existsSync(src)) {
    console.error(`Missing slot: ${slotName}`)
    process.exit(1)
  }
  fs.copyFileSync(src, dest)
  console.log(`public/marketing/${legacyName} ← slots/${slotName}`)
}

// cv-by-design transition page legacy folder
const CV_BY_DESIGN = path.join(ROOT, "public/cv-by-design")
fs.mkdirSync(CV_BY_DESIGN, { recursive: true })
for (const [legacyName, slotName] of Object.entries(MARKETING_MAP)) {
  fs.copyFileSync(path.join(SLOTS, slotName), path.join(CV_BY_DESIGN, legacyName))
}

console.log("Marketing folders synced from illustration slots.")
