/**
 * Sync illustration slot images from public/illustrations/eq-*.png catalog.
 * Editorial artwork only — run import-editorial-library.mjs first.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CATALOG = path.join(ROOT, "public/illustrations")
const SLOTS = path.join(CATALOG, "slots")

function slotToFilename(slot) {
  return `${slot.replace(/\./g, "-")}.png`
}

/** slot → catalog file (each file used exactly once) */
const SLOT_CATALOG = {
  "section.careerBrain": "eq-68.png",
  "section.documents": "eq-02.png",
  "section.coverLetters": "eq-05.png",
  "section.savedDocuments": "eq-70.png",
  "section.applications": "eq-65.png",
  "section.recognitionPathways": "eq-67.png",
  "section.workplaceGerman": "eq-04.png",
  "section.bureaucracyNavigator": "eq-83.png",
  "section.mentoringSupport": "eq-66.png",
  "section.aiJobSearchGuide": "eq-73.png",
  "home.nextStep": "eq-01.png",
  "progress.journeyAccent": "eq-69.png",
  "progress.motivation": "eq-72.png",
  "progress.story": "eq-07.png",
  "careerBrain.hero": "eq-76.png",
  "careerBrain.aiCoach": "eq-08.png",
  "wizard.intro": "eq-17.png",
  "wizard.study": "eq-84.png",
  "wizard.field": "eq-03.png",
  "wizard.experience": "eq-28.png",
  "wizard.recognition": "eq-77.png",
  "wizard.documents": "eq-78.png",
  "wizard.complete": "eq-74.png",
  "marketing.heroPlatform": "eq-79.png",
  "marketing.equity": "eq-71.png",
  "marketing.trustShield": "eq-80.png",
  "marketing.bespokeLab": "eq-81.png",
  "marketing.cvTemplates": "eq-82.png",
}

const used = new Set(Object.values(SLOT_CATALOG))
if (used.size !== Object.keys(SLOT_CATALOG).length) {
  console.error("Duplicate catalog entry in slot map")
  process.exit(1)
}

fs.mkdirSync(SLOTS, { recursive: true })

for (const file of fs.readdirSync(SLOTS)) {
  if (file.includes(".") && file.endsWith(".png") && file.split(".").length > 2) {
    fs.unlinkSync(path.join(SLOTS, file))
    console.log(`Removed legacy: ${file}`)
  }
}

for (const [slot, catalogFile] of Object.entries(SLOT_CATALOG)) {
  const src = path.join(CATALOG, catalogFile)
  const dest = path.join(SLOTS, slotToFilename(slot))
  if (!fs.existsSync(src)) {
    console.error(`Missing catalog file: ${catalogFile}`)
    process.exit(1)
  }
  fs.copyFileSync(src, dest)
  const size = fs.statSync(dest).size
  if (size < 80_000) {
    console.error(`Suspiciously small (likely a UI screenshot): ${dest} (${size} bytes)`)
    process.exit(1)
  }
  console.log(`${slotToFilename(slot)} ← ${catalogFile} (${size} bytes)`)
}

console.log(`Synced ${Object.keys(SLOT_CATALOG).length} illustration slots.`)
