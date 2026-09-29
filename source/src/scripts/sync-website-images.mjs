/**
 * Copy editorial illustration slots into website/images for static HTML pages.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const SLOTS = path.join(ROOT, "public/illustrations/slots")
const WEBSITE_IMAGES = path.resolve(ROOT, "../../website/images")

const WEBSITE_IMAGE_MAP = {
  "hero-platform-core.png": "marketing-heroPlatform.png",
  "hero-person-gem.png": "section-mentoringSupport.png",
  "equity-opportunity.png": "marketing-equity.png",
  "trust-shield.png": "marketing-trustShield.png",
  "bespoke-lab.png": "marketing-bespokeLab.png",
  "cv-templates.png": "marketing-cvTemplates.png",
}

fs.mkdirSync(WEBSITE_IMAGES, { recursive: true })

for (const [websiteName, slotName] of Object.entries(WEBSITE_IMAGE_MAP)) {
  const src = path.join(SLOTS, slotName)
  const dest = path.join(WEBSITE_IMAGES, websiteName)
  if (!fs.existsSync(src)) {
    console.error(`Missing slot image: ${slotName}`)
    process.exit(1)
  }
  fs.copyFileSync(src, dest)
  console.log(`${websiteName} ← slots/${slotName}`)
}

console.log("Website images synced from illustration library.")
